import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ShipmentOrderStatus {
  PENDING = 0, // 待审核
  APPROVED = 1, // 审核通过
  PAID = 2, // 已支付
  SHIPPED = 3, // 已发货
}

@Entity('shipment_orders')
export class ShipmentOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_ids', type: 'text', nullable: true })
  orderIds: string;

  @Column({ type: 'varchar', length: 36, name: 'uid', nullable: true })
  uid: string;

  @Column({ type: 'int', default: 0 })
  status: number;

  @Column({ name: 'ship_way', length: 50, nullable: true })
  shipWay: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  weight: number;

  @Column({
    name: 'post_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  postFee: number;

  @Column({
    name: 'pack_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  packFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount: number;

  @Column({
    name: 'amount_rmb',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  amountRmb: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  rate: number;

  @Column({ length: 100, nullable: true })
  realname: string;

  @Column({ length: 20, nullable: true })
  mobile: string;

  @Column({ length: 50, nullable: true })
  country: string;

  @Column({ length: 50, nullable: true })
  province: string;

  @Column({ length: 50, nullable: true })
  city: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ length: 100, nullable: true })
  postcode: string;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @Column({ name: 'value_added', type: 'text', nullable: true })
  valueAdded: string;

  @Column({ name: 'order_json', type: 'jsonb', nullable: true })
  orderJson: Record<string, any>;

  @Column({
    name: 'after_post_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  afterPostFee: number;

  @Column({
    name: 'over_time_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  overTimeFee: number;

  @Column({ name: 'is_pay', type: 'int', default: 0 })
  isPay: number;

  @Column({ name: 'out_trade_no', length: 100, nullable: true })
  outTradeNo: string;

  @Column({ name: 'store_days', type: 'int', default: 0 })
  storeDays: number;

  @Column({ name: 'last_update_mid', length: 36, nullable: true })
  lastUpdateMid: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
