import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Currency } from './payment.entity';

@Injectable()
export class PingxxService {
  private readonly pingpp: any;
  private readonly logger = new Logger(PingxxService.name);
  private readonly appId: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('pingxx.apiKey');
    this.appId = this.configService.get<string>('pingxx.appId') || '';

    if (!apiKey) {
      this.logger.warn('Ping++ API key not configured');
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Pingpp = require('pingpp');
    Pingpp.apiKey = apiKey || 'sk_test_placeholder';
    this.pingpp = Pingpp;
  }

  /**
   * 创建 Charge（类似 Stripe PaymentIntent）
   */
  async createCharge(params: {
    orderNo: string; // 商户订单号
    amount: number; // 金额（分）
    channel: 'alipay' | 'wx' | 'upacp' | 'cp_b2b';
    currency: Currency;
    clientIp: string;
    subject: string;
    body: string;
    metadata?: Record<string, string>;
    extra?: Record<string, any>; // 渠道额外参数
  }): Promise<{
    chargeId: string;
    paymentUrl: string;
    credential: any;
  }> {
    return new Promise((resolve, reject) => {
      const chargeParams: any = {
        order_no: params.orderNo,
        app: { id: this.appId },
        amount: params.amount,
        channel: params.channel,
        currency: params.currency.toLowerCase(),
        client_ip: params.clientIp,
        subject: params.subject,
        body: params.body,
        metadata: params.metadata || {},
        ...(params.extra && { extra: params.extra }),
      };

      this.pingpp.charges.create(
        chargeParams,
        (err: any, charge: any) => {
          if (err) {
            this.logger.error(`Ping++ createCharge error: ${err.message}`);
            reject(err);
            return;
          }
          if (!charge) {
            reject(new Error('Charge creation returned no result'));
            return;
          }
          resolve({
            chargeId: charge.id,
            paymentUrl: charge.payment_url || '',
            credential: charge.credential,
          });
        },
      );
    });
  }

  /**
   * 检索 Charge 状态
   */
  async retrieveCharge(chargeId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.pingpp.charges.retrieve(
        chargeId,
        (err: any, charge: any) => {
          if (err) {
            this.logger.error(`Ping++ retrieveCharge error: ${err.message}`);
            reject(err);
            return;
          }
          resolve(charge);
        },
      );
    });
  }

  /**
   * 退款
   */
  async createRefund(params: {
    chargeId: string;
    amount?: number; // 不填则全额退款
    reason?: string;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const refundAmount = params.amount
        ? Math.min(params.amount, 9999999999)
        : undefined;

      this.pingpp.charges.createRefund(
        params.chargeId,
        { amount: refundAmount, description: params.reason },
        (err: any, refund: any) => {
          if (err) {
            this.logger.error(`Ping++ createRefund error: ${err.message}`);
            reject(err);
            return;
          }
          resolve(refund);
        },
      );
    });
  }
}
