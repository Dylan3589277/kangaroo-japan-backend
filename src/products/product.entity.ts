import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Category } from "./category.entity";

export enum Platform {
  AMAZON = "amazon",
  MERCARI = "mercari",
  RAKUTEN = "rakuten",
  YAHOO = "yahoo",
}

export enum ProductStatus {
  ACTIVE = "active",
  TRADING = "trading",
  SOLD_OUT = "sold_out",
  UNAVAILABLE = "unavailable",
}

@Entity("products")
// 单字段索引
@Index("idx_products_platform", ["platform"])
@Index("idx_products_category", ["categoryId"])
@Index("idx_products_status", ["status"])
// 复合索引：status 在所有查询中始终存在，与高频过滤/排序字段组合
@Index("idx_products_status_platform", ["status", "platform"])
@Index("idx_products_status_category", ["status", "categoryId"])
@Index("idx_products_status_price", ["status", "priceJpy"])
@Index("idx_products_status_created", ["status", "createdAt"])
@Index("idx_products_status_rating", ["status", "rating"])
export class Product {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 50 })
  platform: Platform;

  @Column({ name: "platform_product_id" })
  platformProductId: string;

  @Column({ type: "text", nullable: true, name: "platform_url" })
  platformUrl: string;

  // 多语言标题
  @Column({ type: "text", nullable: true, name: "title_zh" })
  titleZh: string;

  @Column({ type: "text", nullable: true, name: "title_en" })
  titleEn: string;

  @Column({ type: "text", nullable: true, name: "title_ja" })
  titleJa: string;

  // 多语言描述
  @Column({ type: "text", nullable: true, name: "description_zh" })
  descriptionZh: string;

  @Column({ type: "text", nullable: true, name: "description_en" })
  descriptionEn: string;

  @Column({ type: "text", nullable: true, name: "description_ja" })
  descriptionJa: string;

  // 泰语
  @Column({ type: "text", nullable: true, name: "title_th" })
  titleTh: string;

  @Column({ type: "text", nullable: true, name: "description_th" })
  descriptionTh: string;

  // 越南语
  @Column({ type: "text", nullable: true, name: "title_vi" })
  titleVi: string;

  @Column({ type: "text", nullable: true, name: "description_vi" })
  descriptionVi: string;

  // 印尼语
  @Column({ type: "text", nullable: true, name: "title_id" })
  titleId: string;

  @Column({ type: "text", nullable: true, name: "description_id" })
  descriptionId: string;

  // 价格 (JPY 基准)
  @Column({ type: "decimal", precision: 12, scale: 2, name: "price_jpy" })
  priceJpy: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, name: "price_cny" })
  priceCny: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, name: "price_usd" })
  priceUsd: number;

  @Column({ type: "decimal", precision: 10, scale: 6, nullable: true, name: "exchange_rate_used" })
  exchangeRateUsed: number;

  @Column({ length: 3, default: "JPY" })
  currency: string;

  @Column({ type: "uuid", nullable: true, name: "category_id" })
  categoryId: string;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: "category_id" })
  category: Category;

  // 图片
  @Column({ type: "jsonb", nullable: true })
  images: string[];

  @Column({ type: "int", default: 0, name: "images_count" })
  imagesCount: number;

  // 状态
  @Column({
    type: "varchar",
    length: 50,
    default: ProductStatus.ACTIVE,
  })
  status: ProductStatus;

  // 评分
  @Column({ type: "decimal", precision: 3, scale: 2, nullable: true })
  rating: number;

  @Column({ type: "int", default: 0, name: "review_count" })
  reviewCount: number;

  @Column({ type: "int", default: 0, name: "sales_count" })
  salesCount: number;

  // 规格
  @Column({ type: "jsonb", nullable: true })
  specifications: Record<string, any>;

  // 卖家
  @Column({ nullable: true, name: "seller_name" })
  sellerName: string;

  @Column({ nullable: true, name: "seller_id" })
  sellerId: string;

  // SEO
  @Column({ nullable: true })
  slug: string;

  // 原始数据
  @Column({ type: "jsonb", nullable: true, name: "raw_data" })
  rawData: Record<string, any>;

  // 同步时间
  @Column({ nullable: true, name: "last_synced_at" })
  lastSyncedAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
