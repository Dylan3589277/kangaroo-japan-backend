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

export enum DepositStatus {
  PENDING = 'pending',       // 待支付
  SUCCEEDED = 'succeeded',   // 充值成功
  FAILED = 'failed',         // 充值失败
  REFUNDING = 'refunding',   // 退款中
  REFUNDED = 'refunded',     // 已退款
}

export enum DepositType {
  RECHARGE = 'recharge',           // 充值
  REFUND = 'refund',               // 退款
  DEDUCT = 'deduct',               // 扣除
  ADMIN_RECHARGE = 'admin_recharge', // 后台充值
}

@Entity('deposits')
@Index('idx_deposits_user', ['userId'])
@Index('idx_deposits_order_no', ['orderNo'], { unique: true })
@Index('idx_deposits_status', ['status'])
export class Deposit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: DepositStatus,
    default: DepositStatus.PENDING,
  })
  status: DepositStatus;

  @Column({
    name: 'type',
    type: 'enum',
    enum: DepositType,
    default: DepositType.RECHARGE,
  })
  type: DepositType;

  @Column({ name: 'order_no', unique: true, length: 64 })
  orderNo: string;

  @Column({ name: 'payment_id', nullable: true })
  paymentId: string;

  @Column({ name: 'remark', type: 'text', nullable: true })
  remark: string;

  @Column({ name: 'refund_reason', type: 'text', nullable: true })
  refundReason: string;

  @Column({ name: 'refunded_at', type: 'timestamp', nullable: true })
  refundedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
