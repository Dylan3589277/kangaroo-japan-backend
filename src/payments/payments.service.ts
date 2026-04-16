import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Payment, PaymentStatus, PaymentMethod, PaymentProvider, Currency } from './payment.entity';
import { StripeService } from './stripe.service';
import { PingxxService } from './pingxx.service';
import { OrdersService } from '../orders/orders.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly stripeService: StripeService,
    private readonly pingxxService: PingxxService,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * 生成支付流水号
   */
  private generatePaymentNo(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
    return `PAY${timestamp}${random}`;
  }

  /**
   * 创建支付意图（Stripe 或 Ping++）
   */
  async createPaymentIntent(
    userId: string,
    dto: CreatePaymentIntentDto,
    clientIp: string,
  ): Promise<{
    paymentId: string;
    clientSecret?: string; // Stripe
    paymentUrl?: string;   // Ping++
    chargeId?: string;    // Ping++
    credential?: any;      // 支付凭据
    amount: number;
    currency: string;
    expiresAt: Date;
  }> {
    // 获取订单
    const order = await this.ordersService.findOneByIdAndUser(dto.orderId, userId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // 检查订单是否已支付
    if (order.status !== 'pending' && order.status !== 'paid') {
      throw new BadRequestException(`Order status is ${order.status}, cannot create payment`);
    }

    // 检查是否已有进行中的支付
    const existingPayment = await this.paymentRepository.findOne({
      where: {
        orderId: order.id,
        userId,
        status: PaymentStatus.PENDING,
      },
    });
    if (existingPayment) {
      // 返回已有的支付
      if (existingPayment.provider === PaymentProvider.STRIPE) {
        return {
          paymentId: existingPayment.id,
          clientSecret: (existingPayment.methodDetails as any)?.clientSecret,
          amount: Number(existingPayment.amount),
          currency: existingPayment.currency,
          expiresAt: existingPayment.expiredAt!,
        };
      }
    }

    // 确定支付方式
    const method = dto.method || PaymentMethod.STRIPE;
    const currency = dto.currency || (order.totalCurrency as Currency) || Currency.CNY;

    // 计算过期时间（30分钟）
    const expiredAt = new Date(Date.now() + 30 * 60 * 1000);

    // 根据支付提供商选择
    if (method === PaymentMethod.STRIPE || dto.method === undefined) {
      return this.createStripePayment(userId, order.id, order, currency, dto, expiredAt);
    } else {
      return this.createPingxxPayment(userId, order, currency, dto, clientIp, expiredAt);
    }
  }

  /**
   * 创建 Stripe 支付
   */
  private async createStripePayment(
    userId: string,
    orderId: string,
    order: any,
    currency: Currency,
    dto: CreatePaymentIntentDto,
    expiredAt: Date,
  ) {
    // 计算金额（转为最小单位）
    const amountSmallestUnit = this.toSmallestUnit(Number(order.totalAmount), currency);

    const { clientSecret, paymentIntentId } = await this.stripeService.createPaymentIntent({
      amount: amountSmallestUnit,
      currency: currency.toLowerCase(),
      orderId,
      paymentMethodTypes: dto.paymentMethodTypes || ['card'],
      metadata: { user_id: userId },
    });

    // 创建支付记录
    const payment = this.paymentRepository.create({
      paymentNo: this.generatePaymentNo(),
      orderId,
      userId,
      amount: order.totalAmount,
      currency,
      method: PaymentMethod.STRIPE,
      provider: PaymentProvider.STRIPE,
      status: PaymentStatus.PENDING,
      providerPaymentId: paymentIntentId,
      methodDetails: { clientSecret, paymentIntentId },
      expiredAt,
    });

    await this.paymentRepository.save(payment);

    return {
      paymentId: payment.id,
      clientSecret,
      amount: Number(payment.amount),
      currency: payment.currency,
      expiresAt: payment.expiredAt!,
    };
  }

  /**
   * 创建 Ping++ 支付
   */
  private async createPingxxPayment(
    userId: string,
    order: any,
    currency: Currency,
    dto: CreatePaymentIntentDto,
    clientIp: string,
    expiredAt: Date,
  ) {
    const channel = dto.method === PaymentMethod.ALIPAY ? 'alipay' : 'wx';

    // 计算金额（分）
    const amountCent = Math.round(Number(order.totalAmount) * 100);

    const { chargeId, paymentUrl, credential } = await this.pingxxService.createCharge({
      orderNo: this.generatePaymentNo(),
      amount: amountCent,
      channel,
      currency,
      clientIp,
      subject: `袋鼠君日本-订单${order.orderNo}`,
      body: `商品代购服务-${order.orderNo}`,
      metadata: { order_id: order.id, user_id: userId },
    });

    // 创建支付记录
    const payment = this.paymentRepository.create({
      paymentNo: this.generatePaymentNo(),
      orderId: order.id,
      userId,
      amount: order.totalAmount,
      currency,
      method: dto.method || PaymentMethod.ALIPAY,
      provider: PaymentProvider.PINGXX,
      status: PaymentStatus.PENDING,
      providerPaymentId: chargeId,
      methodDetails: { chargeId, paymentUrl, credential },
      expiredAt,
    });

    await this.paymentRepository.save(payment);

    return {
      paymentId: payment.id,
      paymentUrl,
      chargeId,
      credential,
      amount: Number(payment.amount),
      currency: payment.currency,
      expiresAt: payment.expiredAt!,
    };
  }

  /**
   * 确认支付（主要用于 Stripe）
   */
  async confirmPayment(paymentId: string, userId: string, paymentMethodId?: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.userId !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    if (payment.provider !== PaymentProvider.STRIPE) {
      throw new BadRequestException('Only Stripe payments can be confirmed via this endpoint');
    }

    try {
      const updatedIntent = await this.stripeService.confirmPaymentIntent(
        payment.providerPaymentId,
        paymentMethodId,
      );

      // 更新支付状态
      if (updatedIntent.status === 'succeeded') {
        payment.status = PaymentStatus.SUCCEEDED;
        payment.paidAt = new Date();
        await this.paymentRepository.save(payment);
      }

      return payment;
    } catch (error) {
      payment.status = PaymentStatus.FAILED;
      payment.failureMessage = error.message || 'Unknown error';
      await this.paymentRepository.save(payment);
      throw error;
    }
  }

  /**
   * 取消支付
   */
  async cancelPayment(paymentId: string, userId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.userId !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be cancelled');
    }

    try {
      if (payment.provider === PaymentProvider.STRIPE) {
        await this.stripeService.cancelPaymentIntent(payment.providerPaymentId);
      }
      // Ping++ 支付宝/微信取消由用户端完成，这里只更新状态

      payment.status = PaymentStatus.CANCELLED;
      return this.paymentRepository.save(payment);
    } catch (error) {
      this.logger.error(`Cancel payment failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取支付状态
   */
  async getPaymentStatus(paymentId: string, userId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.userId !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    // 如果是 Stripe，刷新状态
    if (payment.provider === PaymentProvider.STRIPE && payment.status === PaymentStatus.PENDING) {
      try {
        const intent = await this.stripeService.retrievePaymentIntent(payment.providerPaymentId);
        if (intent.status === 'succeeded') {
          payment.status = PaymentStatus.SUCCEEDED;
          payment.paidAt = new Date();
          await this.paymentRepository.save(payment);
        } else if (intent.status === 'canceled') {
          payment.status = PaymentStatus.CANCELLED;
          await this.paymentRepository.save(payment);
        }
      } catch (error) {
        this.logger.warn(`Failed to refresh Stripe payment status: ${error.message}`);
      }
    }

    return payment;
  }

  /**
   * Stripe Webhook 处理
   */
  async handleStripeWebhook(payload: Buffer, signature: string, webhookSecret: string): Promise<void> {
    const event = this.stripeService.constructWebhookEvent(payload, signature, webhookSecret);

    this.logger.log(`Stripe Webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as any;
        await this.handlePaymentSuccess(intent.metadata?.order_id, intent.id);
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as any;
        await this.handlePaymentFailed(intent.metadata?.order_id, intent.id, intent.last_payment_error?.message);
        break;
      }
      case 'payment_intent.canceled': {
        const intent = event.data.object as any;
        await this.handlePaymentCancelled(intent.metadata?.order_id, intent.id);
        break;
      }
      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  /**
   * Ping++ Webhook 处理
   */
  async handlePingxxWebhook(payload: any): Promise<void> {
    const { type, data, object } = payload;

    this.logger.log(`Ping++ Webhook: ${type}`);

    if (type === 'charge.succeeded') {
      const charge = data?.object || object;
      await this.handlePaymentSuccess(charge.metadata?.order_id, charge.id);
    } else if (type === 'charge.failed') {
      const charge = data?.object || object;
      await this.handlePaymentFailed(charge.metadata?.order_id, charge.id, charge.failure_msg);
    }
  }

  /**
   * 处理支付成功
   */
  private async handlePaymentSuccess(orderId: string, providerPaymentId: string): Promise<void> {
    if (!orderId) return;

    const payment = await this.paymentRepository.findOne({
      where: { providerPaymentId },
      relations: ['order'],
    });

    if (!payment) {
      this.logger.warn(`Payment not found for providerPaymentId: ${providerPaymentId}`);
      return;
    }

    if (payment.status === PaymentStatus.SUCCEEDED) {
      return; // 已处理
    }

    payment.status = PaymentStatus.SUCCEEDED;
    payment.paidAt = new Date();
    await this.paymentRepository.save(payment);

    // 更新订单状态
    if (payment.order) {
      await this.ordersService.updatePaymentStatus(
        payment.orderId,
        'paid',
        payment.method,
        payment.id,
      );
    }
  }

  /**
   * 处理支付失败
   */
  private async handlePaymentFailed(
    orderId: string,
    providerPaymentId: string,
    errorMessage?: string,
  ): Promise<void> {
    if (!orderId) return;

    const payment = await this.paymentRepository.findOne({
      where: { providerPaymentId },
    });

    if (!payment) return;

    payment.status = PaymentStatus.FAILED;
    payment.failureMessage = errorMessage || 'Unknown error';
    await this.paymentRepository.save(payment);
  }

  /**
   * 处理支付取消
   */
  private async handlePaymentCancelled(orderId: string, providerPaymentId: string): Promise<void> {
    if (!orderId) return;

    const payment = await this.paymentRepository.findOne({
      where: { providerPaymentId },
    });

    if (!payment) return;

    payment.status = PaymentStatus.CANCELLED;
    await this.paymentRepository.save(payment);
  }

  /**
   * 退款
   */
  async refundPayment(
    paymentId: string,
    userId: string,
    amount?: number,
    reason?: string,
  ): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new BadRequestException('Only succeeded payments can be refunded');
    }

    try {
      if (payment.provider === PaymentProvider.STRIPE) {
        await this.stripeService.createRefund({
          paymentIntentId: payment.providerPaymentId,
          amount: amount ? Math.round(amount * 100) : undefined,
          reason,
        });
      } else {
        const amountCent = amount ? Math.round(amount * 100) : undefined;
        await this.pingxxService.createRefund({
          chargeId: payment.providerPaymentId,
          amount: amountCent,
          reason,
        });
      }

      payment.status = PaymentStatus.REFUNDED;
      payment.refundedAt = new Date();
      payment.refundAmount = amount || Number(payment.amount);
      payment.refundReason = reason || '';
      await this.paymentRepository.save(payment);

      // 更新订单状态
      await this.ordersService.updatePaymentStatus(
        payment.orderId,
        'refunded',
        undefined,
        undefined,
      );

      return payment;
    } catch (error) {
      this.logger.error(`Refund failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 转为最小单位（分）
   */
  private toSmallestUnit(amount: number, currency: Currency): number {
    // Stripe 使用货币的最小单位（JPY 无小数位）
    if (currency === Currency.JPY) {
      return Math.round(amount);
    }
    return Math.round(amount * 100);
  }
}
