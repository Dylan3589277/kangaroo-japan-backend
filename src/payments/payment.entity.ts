import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';

export enum PaymentStatus {
  PENDING = 'pending',       // 待支付
  PROCESSING = 'processing', // 支付中
  SUCCEEDED = 'succeeded',   // 支付成功
  FAILED = 'failed',         // 支付失败
  CANCELLED = 'cancelled',   // 已取消
  REFUNDED = 'refunded',     // 已退款
}

export enum PaymentMethod {
  STRIPE = 'stripe',
  ALIPAY = 'alipay',
  WECHAT_PAY = 'wechat_pay',
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  PINGXX = 'pingxx',
}

export enum Currency {
  CNY = 'CNY',
  USD = 'USD',
  JPY = 'JPY',
}

@Entity('payments')
@Index('idx_payments_order', ['orderId'])
@Index('idx_payments_user', ['userId'])
@Index('idx_payments_status', ['status'])
@Index('idx_payments_payment_no', ['paymentNo'], { unique: true })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_no', unique: true, length: 64 })
  paymentNo: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // 金额
  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({
    name: 'currency',
    type: 'enum',
    enum: Currency,
    default: Currency.CNY,
  })
  currency: Currency;

  // 支付方式
  @Column({
    name: 'method',
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod;

  @Column({ name: 'method_details', type: 'jsonb', nullable: true })
  methodDetails: Record<string, any>;

  // 状态
  @Column({
    name: 'status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  // 支付平台
  @Column({
    name: 'provider',
    type: 'enum',
    enum: PaymentProvider,
  })
  provider: PaymentProvider;

  @Column({ name: 'provider_payment_id', length: 255, nullable: true })
  providerPaymentId: string;

  // 时间
  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ name: 'expired_at', type: 'timestamp', nullable: true })
  expiredAt: Date;

  // 退款
  @Column({ name: 'refunded_at', type: 'timestamp', nullable: true })
  refundedAt: Date;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  refundAmount: number;

  @Column({ name: 'refund_reason', type: 'text', nullable: true })
  refundReason: string;

  @Column({ name: 'failure_message', type: 'text', nullable: true })
  failureMessage: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
