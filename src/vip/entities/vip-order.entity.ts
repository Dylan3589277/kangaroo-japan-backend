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
import { User } from '../../users/user.entity';

@Entity('vip_orders')
@Index('idx_vip_orders_user', ['userId'])
@Index('idx_vip_orders_out_trade_no', ['outTradeNo'], { unique: true })
export class VipOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int' })
  level: number;

  @Column({ name: 'level_name', length: 50 })
  levelName: string;

  @Column({ name: 'price', type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'int' })
  month: number;

  @Column({ name: 'amount', type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ name: 'offset_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  offsetAmount: number;

  @Column({ name: 'out_trade_no', length: 64 })
  outTradeNo: string;

  @Column({ name: 'is_pay', default: false })
  isPay: boolean;

  @Column({ name: 'pay_time', type: 'timestamp', nullable: true })
  payTime: Date;

  @Column({ name: 'level_end_time', type: 'int', nullable: true, comment: '下单时剩余到期时间(秒时间戳)' })
  levelEndTime: number;

  @Column({ name: 'payment_id', nullable: true })
  paymentId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
