import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../products/product.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  // 商品快照
  @Column()
  platform: string;

  @Column({ name: 'platform_product_id', length: 255, nullable: true })
  platformProductId: string;

  @Column({ name: 'title_zh_snapshot', type: 'text', nullable: true })
  titleZhSnapshot: string;

  @Column({ name: 'title_en_snapshot', type: 'text', nullable: true })
  titleEnSnapshot: string;

  @Column({ name: 'title_ja_snapshot', type: 'text', nullable: true })
  titleJaSnapshot: string;

  @Column({ name: 'cover_image_url', length: 500, nullable: true })
  coverImageUrl: string;

  // 购买时的价格
  @Column({ name: 'unit_price_jpy', type: 'decimal', precision: 12, scale: 2 })
  unitPriceJpy: number;

  @Column({ name: 'unit_price_cny', type: 'decimal', precision: 12, scale: 2 })
  unitPriceCny: number;

  @Column({ default: 1 })
  quantity: number;

  @Column({ name: 'subtotal_jpy', type: 'decimal', precision: 12, scale: 2 })
  subtotalJpy: number;

  @Column({ name: 'subtotal_cny', type: 'decimal', precision: 12, scale: 2 })
  subtotalCny: number;

  // 选项
  @Column({ type: 'jsonb', default: '{}' })
  options: Record<string, any>;

  // 卖家
  @Column({ name: 'seller_id', length: 255, nullable: true })
  sellerId: string;

  @Column({ name: 'seller_name', length: 255, nullable: true })
  sellerName: string;

  // 状态
  @Column({ length: 50, default: 'pending' })
  status: string;

  @Column({ name: 'tracking_number', length: 255, nullable: true })
  trackingNumber: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
