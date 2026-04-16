import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');

@Injectable()
export class StripeService {
  private readonly stripe: any;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('stripe.secretKey');
    if (!secretKey) {
      this.logger.warn('Stripe secret key not configured');
    }
    this.stripe = new Stripe(secretKey || 'sk_test_placeholder', {
      apiVersion: '2026-03-25.dahlia',
    });
  }

  /**
   * 创建 PaymentIntent
   */
  async createPaymentIntent(params: {
    amount: number; // 最小单位（分）
    currency: string;
    orderId: string;
    customerId?: string;
    paymentMethodTypes?: string[];
    metadata?: Record<string, string>;
  }): Promise<{
    clientSecret: string;
    paymentIntentId: string;
  }> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        order_id: params.orderId,
        ...params.metadata,
      },
      ...(params.customerId && { customer: params.customerId }),
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * 确认 PaymentIntent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string,
  ): Promise<any> {
    if (paymentMethodId) {
      return this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
      });
    }
    return this.stripe.paymentIntents.confirm(paymentIntentId);
  }

  /**
   * 取消 PaymentIntent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<any> {
    return this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  /**
   * 检索 PaymentIntent 状态
   */
  async retrievePaymentIntent(paymentIntentId: string): Promise<any> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * 退款
   */
  async createRefund(params: {
    paymentIntentId: string;
    amount?: number; // 不填则全额退款
    reason?: string;
  }): Promise<any> {
    return this.stripe.refunds.create({
      payment_intent: params.paymentIntentId,
      amount: params.amount,
      reason: 'requested_by_customer',
      metadata: params.reason ? { reason: params.reason } : undefined,
    });
  }

  /**
   * 构造 Stripe Webhook 事件
   */
  constructWebhookEvent(
    payload: Buffer,
    signature: string,
    webhookSecret: string,
  ): any {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  }
}
