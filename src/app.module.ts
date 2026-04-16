import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { databaseConfig } from "./config/database.config";
import { User } from "./users/user.entity";
import { Address } from "./users/address.entity";
import { Product } from "./products/product.entity";
import { Category } from "./products/category.entity";
import { Order } from "./orders/order.entity";
import { OrderItem } from "./orders/order-item.entity";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ProductsModule } from "./products/products.module";
import { CartModule } from "./cart/cart.module";
import { OrdersModule } from "./orders/orders.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      load: [databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get("database.host"),
        port: config.get<number>("database.port"),
        username: config.get("database.username"),
        password: config.get("database.password"),
        database: config.get("database.database"),
        entities: [User, Address, Product, Category, Order, OrderItem],
        synchronize: config.get<boolean>("database.synchronize"),
        logging: config.get("database.logging"),
        migrationsRun: config.get<boolean>("database.migrationsRun"),
        migrations: [__dirname + "/database/migrations/*{.ts,.js}"],
        migrationsTableName: "typeorm_migrations",
      }),
    }),
    AuthModule,
    UsersModule,
    ProductsModule,
    CartModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
