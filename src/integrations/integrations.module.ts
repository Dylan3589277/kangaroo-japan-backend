/**
 * 电商平台集成模块
 * 
 * 支持:
 * - 乐天市场 (Rakuten)
 * - Amazon Japan
 * - Yahoo!购物
 * - Mercari
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/product.entity';
import { Category } from '../products/category.entity';
import { RakutenService } from './rakuten.service';
import { AmazonService } from './amazon.service';
import { YahooService } from './yahoo.service';
import { MercariService } from './mercari.service';
import { SyncService } from './sync.service';
import { IntegrationsController } from './integrations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Category]),
  ],
  controllers: [IntegrationsController],
  providers: [
    RakutenService,
    AmazonService,
    YahooService,
    MercariService,
    SyncService,
  ],
  exports: [
    RakutenService,
    AmazonService,
    YahooService,
    MercariService,
    SyncService,
  ],
})
export class IntegrationsModule {}
