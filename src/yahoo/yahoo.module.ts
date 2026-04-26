import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YahooGoods } from './entities/yahoo-goods.entity';
import { YahooBid } from './entities/yahoo-bid.entity';
import { YahooController } from './yahoo.controller';
import { YahooGoodsService } from './yahoo.goods.service';
import { YahooBidService } from './yahoo.bid.service';
import { DepositModule } from '../deposit/deposit.module';

@Module({
  imports: [TypeOrmModule.forFeature([YahooGoods, YahooBid]), DepositModule],
  controllers: [YahooController],
  providers: [YahooGoodsService, YahooBidService],
})
export class YahooModule {}
