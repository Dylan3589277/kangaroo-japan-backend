import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from './entities/coupon.entity';
import { UserCoupon } from './entities/user-coupon.entity';
import { ScoreLog } from './entities/score-log.entity';
import { ScoreShopService } from './score-shop.service';
import { ScoreShopController } from './score-shop.controller';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Coupon, UserCoupon, ScoreLog, User]),
  ],
  providers: [ScoreShopService],
  controllers: [ScoreShopController],
  exports: [ScoreShopService],
})
export class ScoreShopModule {}
