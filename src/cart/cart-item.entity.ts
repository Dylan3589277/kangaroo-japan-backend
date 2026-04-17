import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Cart } from './cart.entity';
import { Product } from '../products/product.entity';

export enum CartItemStatus {
  ACTIVE = 'active',
  RESERVED = 'reserved',
  REMOVED = 'removed',
}

@Entity('cart_items')
@Index('idx_cart_items_cart', ['cartId'])
@Index('idx_cart_items_product', ['productId'])
@Index('idx_cart_items_seller', ['sellerId'])
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cart_id' })
  cartId: string;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;

  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'price_at_add_jpy',
  })
  priceAtAddJpy: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'price_at_add_cny',
  })
  priceAtAddCny: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'price_at_add_usd',
  })
  priceAtAddUsd: number;

  @Column({ type: 'jsonb', nullable: true })
  options: Record<string, any>;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    name: 'buyer_message',
  })
  buyerMessage: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: CartItemStatus.ACTIVE,
  })
  status: CartItemStatus;

  @Column({ nullable: true, name: 'seller_id' })
  sellerId: string;

  @Column({ nullable: true, name: 'seller_name' })
  sellerName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
