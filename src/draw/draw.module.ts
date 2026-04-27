import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DrawActivity } from './entities/draw-activity.entity';
import { DrawPrize } from './entities/draw-prize.entity';
import { DrawLog } from './entities/draw-log.entity';
import { DrawController } from './draw.controller';
import { DrawService } from './draw.service';
import { User } from '../users/user.entity';
import { ScoreLog } from '../score-shop/entities/score-log.entity';
import { Coupon } from '../score-shop/entities/coupon.entity';
import { UserCoupon } from '../score-shop/entities/user-coupon.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DrawActivity, DrawPrize, DrawLog, User, ScoreLog, Coupon, UserCoupon]),
  ],
  controllers: [DrawController],
  providers: [DrawService],
})
export class DrawModule {}
