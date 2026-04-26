import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 500, nullable: true })
  icon: string;

  @Column({ length: 20, comment: '类型: rate=折扣, cash=代金券' })
  type: string;

  @Column({ name: 'order_type', length: 50, nullable: true, comment: '适用订单类型' })
  orderType: string;

  @Column({ name: 'data', type: 'decimal', precision: 10, scale: 2, comment: '面值' })
  data: number;

  @Column({ name: 'condition', type: 'decimal', precision: 10, scale: 2, default: 0, comment: '满减条件' })
  condition: number;

  @Column({ name: 'expire_days', type: 'int', default: 0, comment: '有效期（天）' })
  expireDays: number;

  @Column({ type: 'int', default: 0, comment: '库存' })
  stock: number;

  @Column({ type: 'int', default: 0, comment: '已发放数量' })
  number: number;

  @Column({ type: 'int', default: 0, comment: '兑换所需积分' })
  score: number;

  @Column({ default: false, comment: '是否可兑换' })
  canbuy: boolean;

  @Column({ name: 'act_type', length: 30, nullable: true, comment: '活动类型' })
  actType: string;

  @Column({ name: 'act_extras', type: 'jsonb', nullable: true, comment: '额外配置' })
  actExtras: Record<string, any>;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
