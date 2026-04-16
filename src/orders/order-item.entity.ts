import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Order } from "./order.entity";
import { Product } from "../products/product.entity";

@Entity("order_items")
export class OrderItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "order_id" })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items)
  @JoinColumn({ name: "order_id" })
  order: Order;

  @Column({ name: "product_id" })
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: "product_id" })
  product: Product;

  @Column()
  platform: string;

  @Column({ default: 1 })
  quantity: number;

  @Column({
    name: "price_at_purchase",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  priceAtPurchase: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
