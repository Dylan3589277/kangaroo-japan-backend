import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { Coupon } from './coupon.entity';

@Entity('user_coupons')
@Index('idx_user_coupons_user', ['userId'])
@Index('idx_user_coupons_coupon', ['couponId'])
export class UserCoupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'coupon_id' })
  couponId: string;

  @ManyToOne(() => Coupon)
  @JoinColumn({ name: 'coupon_id' })
  coupon: Coupon;

  @Column({ length: 64, unique: true, comment: '优惠券兑换码' })
  code: string;

  @Column({ length: 20, comment: '类型: rate=折扣, cash=代金券' })
  type: string;

  @Column({ name: 'order_type', length: 50, nullable: true, comment: '适用订单类型' })
  orderType: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 500, nullable: true })
  icon: string;

  @Column({ name: 'condition', type: 'decimal', precision: 10, scale: 2, default: 0, comment: '满减条件' })
  condition: number;

  @Column({ name: 'data', type: 'decimal', precision: 10, scale: 2, comment: '面值' })
  data: number;

  @Column({ type: 'timestamp', nullable: true, comment: '过期时间' })
  expire: Date | null;

  @Column({ length: 30, default: 'exchange', comment: '来源: exchange=积分兑换, free=免费领取' })
  source: string;

  @Column({ name: 'used_at', type: 'timestamp', nullable: true, comment: '使用时间' })
  usedAt: Date;

  @Column({ name: 'order_id', nullable: true, comment: '关联订单ID' })
  orderId: string;

  @Column({ name: 'is_used', default: false })
  isUsed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
