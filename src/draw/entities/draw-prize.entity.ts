import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum DrawPrizeType {
  COUPON = 'coupon',
  SCORE = 'score',
  NONE = 'none',
}

@Entity('draw_prizes')
@Index('idx_draw_prizes_activity', ['activityId'])
export class DrawPrize {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'activity_id', nullable: true })
  activityId: string;

  @Column({
    name: 'type',
    type: 'enum',
    enum: DrawPrizeType,
    default: DrawPrizeType.NONE,
    comment: 'coupon=优惠券 score=积分 none=未中奖',
  })
  type: DrawPrizeType;

  @Column({ name: 'name', length: 128, default: '' })
  name: string;

  @Column({ name: 'cover', type: 'text', nullable: true })
  cover: string;

  @Column({
    name: 'prize',
    length: 64,
    default: '0',
    comment: '奖品ID(优惠券ID/积分数量)',
  })
  prize: string;

  @Column({
    name: 'rate',
    type: 'int',
    default: 0,
    comment: '概率权重(越小越优先)',
  })
  rate: number;

  @Column({ name: 'number', type: 'int', default: 0, comment: '总库存' })
  number: number;

  @Column({ name: 'left_number', type: 'int', default: 0, comment: '剩余库存' })
  leftNumber: number;

  @Column({ name: 'sales', type: 'int', default: 0, comment: '已兑数量' })
  sales: number;

  @Column({ name: 'is_deleted', type: 'int', default: 0 })
  isDeleted: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
