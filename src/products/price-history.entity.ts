import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { Product } from "./product.entity";

@Entity("price_history")
@Index("idx_price_history_product", ["productId"])
@Index("idx_price_history_recorded", ["recordedAt"])
@Unique("uniq_price_history_product_recorded", ["productId", "recordedAt"])
export class PriceHistory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "product_id" })
  productId: string;

  @ManyToOne(() => Product, { onDelete: "CASCADE" })
  @JoinColumn({ name: "product_id" })
  product: Product;

  @Column({ type: "decimal", precision: 12, scale: 2, name: "price_jpy" })
  priceJpy: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, name: "price_cny" })
  priceCny: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, name: "price_usd" })
  priceUsd: number;

  @Column({ type: "decimal", precision: 10, scale: 6, nullable: true, name: "exchange_rate" })
  exchangeRate: number;

  @Column({ type: "timestamp", default: () => "NOW()", name: "recorded_at" })
  recordedAt: Date;

  @Column({ type: "varchar", length: 50, nullable: true, name: "platform_status" })
  platformStatus: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
