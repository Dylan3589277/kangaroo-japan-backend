import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YahooGoods } from './entities/yahoo-goods.entity';
import { YahooBid } from './entities/yahoo-bid.entity';
import { YahooController } from './yahoo.controller';
import { YahooGoodsService } from './yahoo.goods.service';
import { YahooBidService, YAHOO_BID_PROVIDER, PhpProxyYahooBidProvider } from './yahoo.bid.service';

@Module({
  imports: [TypeOrmModule.forFeature([YahooGoods, YahooBid])],
  controllers: [YahooController],
  providers: [
    YahooGoodsService,
    YahooBidService,
    {
      provide: YAHOO_BID_PROVIDER,
      useClass: PhpProxyYahooBidProvider,
    },
  ],
})
export class YahooModule {}
