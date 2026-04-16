import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "../users/user.entity";
import { Address } from "../users/address.entity";
import { OrderItem } from "./order-item.entity";

export enum OrderStatus {
  PENDING = "pending",
  PAID = "paid",
  SHIPPED = "shipped",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
}

@Entity("orders")
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "order_no", unique: true, length: 50 })
  orderNo: string;

  @Column({ name: "user_id" })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({
    type: "enum",
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({
    name: "total_amount",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  totalAmount: number;

  @Column({ length: 3, default: "JPY" })
  currency: string;

  @Column({
    name: "shipping_fee",
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  shippingFee: number;

  @Column({ name: "address_id", nullable: true })
  addressId: string;

  @ManyToOne(() => Address, { nullable: true })
  @JoinColumn({ name: "address_id" })
  address: Address;

  @Column({ name: "payment_method", nullable: true })
  paymentMethod: string;

  @Column({ name: "paid_at", type: "timestamp", nullable: true })
  paidAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];
}
