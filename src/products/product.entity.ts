import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Category } from "./category.entity";

export enum Platform {
  AMAZON = "amazon",
  MERCARI = "mercari",
  RAKUTEN = "rakuten",
  YAHOO = "yahoo",
}

@Entity("products")
export class Product {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  platform: Platform;

  @Column({ name: "platform_product_id" })
  platformProductId: string;

  @Column({ type: "text", nullable: true, name: "title_zh" })
  titleZh: string;

  @Column({ type: "text", nullable: true, name: "title_en" })
  titleEn: string;

  @Column({ type: "text", nullable: true, name: "title_ja" })
  titleJa: string;

  @Column({ type: "text", nullable: true, name: "description_zh" })
  descriptionZh: string;

  @Column({ type: "text", nullable: true, name: "description_en" })
  descriptionEn: string;

  @Column({ type: "text", nullable: true, name: "description_ja" })
  descriptionJa: string;

  @Column({ type: "decimal", precision: 10, scale: 2, name: "price_jpy" })
  priceJpy: number;

  @Column({ type: "decimal", precision: 10, scale: 2, name: "price_cny", nullable: true })
  priceCny: number;

  @Column({ type: "decimal", precision: 10, scale: 2, name: "price_usd", nullable: true })
  priceUsd: number;

  @Column({ length: 3, default: "JPY" })
  currency: string;

  @Column({ type: "jsonb", nullable: true })
  images: string[];

  @Column({ name: "category_id", nullable: true })
  categoryId: string;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: "category_id" })
  category: Category;

  @Column({ type: "decimal", precision: 3, scale: 1, nullable: true })
  rating: number;

  @Column({ name: "review_count", nullable: true })
  reviewCount: number;

  @Column({ name: "sales_count", nullable: true })
  salesCount: number;

  @Column({ type: "text", nullable: true })
  url: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
