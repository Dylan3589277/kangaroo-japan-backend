import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { databaseConfig } from './config/database.config';
import { paymentConfig } from './config/payment.config';
import exchangeConfig from './config/exchange.config';
import { User } from './users/user.entity';
import { Address } from './users/address.entity';
import { Product } from './products/product.entity';
import { Category } from './products/category.entity';
import { PriceHistory } from './products/price-history.entity';
import { Order } from './orders/order.entity';
import { OrderItem } from './orders/order-item.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { Cart } from './cart/cart.entity';
import { CartItem } from './cart/cart-item.entity';
import { OrdersModule } from './orders/orders.module';
import { AddressesModule } from './addresses/addresses.module';
import { CategoriesModule } from './categories/categories.module';
import { PaymentsModule } from './payments/payments.module';
import { Payment } from './payments/payment.entity';
import { IntegrationsModule } from './integrations/integrations.module';
import { ShippingModule } from './shipping/shipping.module';
import { HealthModule } from './health/health.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WechatModule } from './wechat/wechat.module';
import { SmsModule } from './sms/sms.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { ShipmentOrder } from './warehouse/entities/shipment-order.entity';
import { OrderPhoto } from './warehouse/entities/order-photo.entity';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [databaseConfig, paymentConfig, exchangeConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get<number>('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.database'),
        entities: [
          User,
          Address,
          Product,
          Category,
          PriceHistory,
          Order,
          OrderItem,
          Cart,
          CartItem,
          Payment,
          ShipmentOrder,
          OrderPhoto,
        ],
        synchronize: config.get<boolean>('database.synchronize'),
        logging: config.get('database.logging'),
        migrationsRun: config.get<boolean>('database.migrationsRun'),
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsTableName: 'typeorm_migrations',
      }),
    }),
    AuthModule,
    UsersModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    AddressesModule,
    CategoriesModule,
    PaymentsModule,
    IntegrationsModule,
    ShippingModule,
    HealthModule,
    DashboardModule,
    WechatModule,
    SmsModule,
    WarehouseModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
