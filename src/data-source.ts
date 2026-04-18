import { DataSource } from 'typeorm';
import { User } from './users/user.entity';
import { Address } from './users/address.entity';
import { Product } from './products/product.entity';
import { Category } from './products/category.entity';
import { PriceHistory } from './products/price-history.entity';
import { Order } from './orders/order.entity';
import { OrderItem } from './orders/order-item.entity';
import { Cart } from './cart/cart.entity';
import { CartItem } from './cart/cart-item.entity';
import { Payment } from './payments/payment.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Address, Product, Category, PriceHistory, Order, OrderItem, Cart, CartItem, Payment],
  migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: true,
});
