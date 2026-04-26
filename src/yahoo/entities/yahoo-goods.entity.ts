import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('yahoo_goods')
@Index('idx_yahoo_goods_no', ['goodsNo'], { unique: true })
@Index('idx_yahoo_status', ['status'])
export class YahooGoods {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'goods_no', length: 64, unique: true })
  goodsNo: string;

  @Column({ name: 'goods_name', type: 'text' })
  goodsName: string;

  @Column({
    name: 'price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  price: number;

  @Column({
    name: 'bid_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  bidPrice: number;

  @Column({
    name: 'fastprice',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  fastprice: number;

  @Column({ name: 'cover', type: 'text', nullable: true })
  cover: string;

  @Column({ name: 'images', type: 'json', default: '[]' })
  images: string[];

  @Column({ name: 'seller', length: 255, nullable: true })
  seller: string;

  @Column({ name: 'seller_id', length: 255, nullable: true })
  sellerId: string;

  @Column({ name: 'seller_address', length: 255, nullable: true })
  sellerAddress: string;

  @Column({ name: 'rate_num', length: 64, nullable: true })
  rateNum: string;

  @Column({ name: 'rate_percent', length: 64, nullable: true })
  ratePercent: string;

  @Column({ name: 'bid_num', type: 'int', default: 0 })
  bidNum: number;

  @Column({ name: 'content', type: 'text', nullable: true })
  content: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'extras', type: 'json', default: '[]' })
  extras: { name: string; value: string }[];

  @Column({ name: 'url', type: 'text', nullable: true })
  url: string;

  @Column({ name: 'end_time', length: 128, nullable: true })
  endTime: string;

  @Column({ name: 'left_timestamp', type: 'int', default: 0 })
  leftTimestamp: number;

  @Column({ name: 'price_title', length: 32, nullable: true })
  priceTitle: string;

  @Column({ name: 'category_id', type: 'int', default: 0 })
  categoryId: number;

  @Column({ name: 'status', length: 32, default: 'active' })
  status: string;

  @Column({ name: 'raw_data', type: 'json', nullable: true })
  rawData: Record<string, unknown>;

  @Column({ name: 'last_synced_at', type: 'timestamp', nullable: true })
  lastSyncedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 计算字段（不存数据库）
  canBid: number;
  isHigh: boolean;
  bidStatus: string;
  lastInfo: { price: number };
  tipList: string[];
  collect: boolean;
}

export enum YahooGoodsStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
  SOLD = 'sold',
}
