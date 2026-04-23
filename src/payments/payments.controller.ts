import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
  rawBody?: Buffer;
}

@ApiTags('支付')
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * 创建支付意图
   */
  @Post('create-intent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '创建支付意图' })
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer Token',
    required: true,
  })
  @ApiResponse({ status: 200, description: '创建成功' })
  @ApiResponse({ status: 400, description: '请求错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async createIntent(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const clientIp = this.getClientIp(req);
    const result = await this.paymentsService.createPaymentIntent(
      userId,
      dto,
      clientIp,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 确认支付
   */
  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '确认支付' })
  @ApiResponse({ status: 200, description: '确认成功' })
  @ApiResponse({ status: 400, description: '请求错误' })
  async confirmPayment(
    @Req() req: AuthenticatedRequest,
    @Param('id') paymentId: string,
    @Body() body: { payment_method_id?: string },
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const payment = await this.paymentsService.confirmPayment(
      paymentId,
      userId,
      body.payment_method_id,
    );

    return {
      success: true,
      data: payment,
    };
  }

  /**
   * 取消支付
   */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消支付' })
  @ApiResponse({ status: 200, description: '取消成功' })
  async cancelPayment(
    @Req() req: AuthenticatedRequest,
    @Param('id') paymentId: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const payment = await this.paymentsService.cancelPayment(paymentId, userId);

    return {
      success: true,
      data: payment,
    };
  }

  /**
   * 获取支付状态
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取支付状态' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getPaymentStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') paymentId: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const payment = await this.paymentsService.getPaymentStatus(
      paymentId,
      userId,
    );

    return {
      success: true,
      data: payment,
    };
  }

  /**
   * Stripe Webhook
   */
  @Post('webhook/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe 支付回调' })
  @ApiResponse({ status: 200, description: '处理成功' })
  async stripeWebhook(
    @Req() req: AuthenticatedRequest,
    @Headers('stripe-signature') signature: string,
    @Body() body: Record<string, unknown>,
  ) {
    // 获取 webhook secret
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    // Stripe 需要原始 body（已在 main.ts 中通过 verify 函数设置到 req.rawBody）
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(body));

    await this.paymentsService.handleStripeWebhook(
      rawBody,
      signature,
      webhookSecret,
    );

    return { received: true };
  }

  /**
   * Ping++ Webhook
   */
  @Post('webhook/pingxx')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ping++ 支付回调' })
  @ApiResponse({ status: 200, description: '处理成功' })
  async pingxxWebhook(
    @Req() req: Request,
    @Headers('x-pingplusplus-signature') signature: string,
    @Body() body: unknown,
  ) {
    await this.paymentsService.handlePingxxWebhook(req, signature, body);

    return { received: true };
  }

  /**
   * 退款
   */
  @Post(':id/refund')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '退款' })
  @ApiResponse({ status: 200, description: '退款成功' })
  async refundPayment(
    @Req() req: AuthenticatedRequest,
    @Param('id') paymentId: string,
    @Body() body: { amount?: number; reason?: string },
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const payment = await this.paymentsService.refundPayment(
      paymentId,
      userId,
      body.amount,
      body.reason,
    );

    return {
      success: true,
      data: payment,
    };
  }

  /**
   * 获取客户端 IP
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket?.remoteAddress ||
      '127.0.0.1'
    );
  }
}
