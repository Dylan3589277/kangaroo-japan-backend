import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserLevel } from './entities/user-level.entity';
import { VipOrder } from './entities/vip-order.entity';
import { VipService } from './vip.service';
import { VipController } from './vip.controller';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserLevel, VipOrder, User]),
  ],
  controllers: [VipController],
  providers: [VipService],
  exports: [VipService],
})
export class VipModule {}
