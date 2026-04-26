/**
 * 订单状态流转文档
 *
 * 状态说明：
 *   PENDING     (待支付)   — 订单已创建，等待用户完成支付
 *   PAID        (已支付)   — 支付成功，等待运营人员处理
 *   PROCESSING  (处理中)   — 运营人员已接单，正在日本代购商品
 *   PURCHASED   (已代购)   — 商品已在日本购买完毕，等待发货
 *   SHIPPED     (已发货)   — 商品已从日本发出，物流单号已录入
 *   IN_TRANSIT  (运输中)   — 包裹正在国际运输途中
 *   DELIVERED   (已送达)   — 包裹已签收送达
 *   CANCELLED   (已取消)   — 订单已取消（支付前或支付后退款前）
 *   REFUNDED    (已退款)   — 退款已处理完成
 *
 * 合法状态流转路径：
 *
 *   正常履约流程：
 *     PENDING → PAID → PROCESSING → PURCHASED → SHIPPED → IN_TRANSIT → DELIVERED
 *
 *   取消/退款流程：
 *     PENDING   → CANCELLED   （未支付前用户主动取消）
 *     PAID      → CANCELLED   （已支付但未开始代购，运营取消）
 *     PAID      → REFUNDED    （直接退款，不经过 CANCELLED）
 *     PROCESSING → CANCELLED  （代购过程中异常，运营取消并退款前置状态）
 *     PROCESSING → REFUNDED
 *     PURCHASED → REFUNDED    （已购买但无法发货时退款）
 *
 *   禁止的流转（不可逆）：
 *     SHIPPED / IN_TRANSIT / DELIVERED → 任何其他状态
 *     CANCELLED / REFUNDED → 任何其他状态
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Address } from '../users/address.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'pending',         // 待支付
  PAID = 'paid',               // 已支付
  PROCESSING = 'processing',   // 处理中
  PURCHASED = 'purchased',     // 已代购
  SHIPPED = 'shipped',         // 已发货
  IN_TRANSIT = 'in_transit',   // 运输中
  DELIVERED = 'delivered',     // 已送达
  CANCELLED = 'cancelled',     // 已取消
  REFUNDED = 'refunded',       // 已退款
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_no', unique: true, length: 50 })
  orderNo: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'address_id' })
  addressId: string;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'address_id' })
  address: Address;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  // 金额明细
  @Column({ name: 'subtotal_jpy', type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotalJpy: number;

  @Column({ name: 'subtotal_cny', type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotalCny: number;

  @Column({ name: 'subtotal_usd', type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotalUsd: number;

  @Column({ name: 'shipping_fee_jpy', type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingFeeJpy: number;

  @Column({ name: 'shipping_fee_cny', type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingFeeCny: number;

  @Column({ name: 'service_fee_jpy', type: 'decimal', precision: 12, scale: 2, default: 0 })
  serviceFeeJpy: number;

  @Column({ name: 'service_fee_cny', type: 'decimal', precision: 12, scale: 2, default: 0 })
  serviceFeeCny: number;

  @Column({ name: 'coupon_discount_cny', type: 'decimal', precision: 12, scale: 2, default: 0 })
  couponDiscountCny: number;

  // 总计（用户实际支付币种）
  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ name: 'total_currency', length: 3, default: 'CNY' })
  totalCurrency: string;

  // 支付信息
  @Column({ name: 'payment_method', length: 50, nullable: true })
  paymentMethod: string;

  @Column({ name: 'payment_id', length: 255, nullable: true })
  paymentId: string;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ name: 'exchange_rate_used', type: 'decimal', precision: 10, scale: 6, nullable: true })
  exchangeRateUsed: number;

  // 买家留言
  @Column({ name: 'buyer_message', type: 'text', nullable: true })
  buyerMessage: string;

  // 物流信息
  @Column({ name: 'tracking_number', length: 255, nullable: true })
  trackingNumber: string;

  @Column({ name: 'shipping_carrier', length: 100, nullable: true })
  shippingCarrier: string; // EMS, DHL, FedEx

  @Column({ name: 'shipped_at', type: 'timestamp', nullable: true })
  shippedAt: Date;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @Column({ name: 'estimated_delivery', type: 'date', nullable: true })
  estimatedDelivery: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];
}
