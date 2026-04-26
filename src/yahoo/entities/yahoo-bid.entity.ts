import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum YahooBidStatus {
  BIDDING = 'bidding',
  WON = 'won',
  LOST = 'lost',
  CANCELLED = 'cancelled',
}

@Entity('yahoo_bids')
@Index('idx_yahoo_bids_user', ['userId'])
@Index('idx_yahoo_bids_goods', ['goodsNo'])
export class YahooBid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'goods_no', length: 64 })
  goodsNo: string;

  @Column({ name: 'price', type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: YahooBidStatus,
    default: YahooBidStatus.BIDDING,
  })
  status: YahooBidStatus;

  @Column({ name: 'is_high', type: 'boolean', default: false })
  isHigh: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
