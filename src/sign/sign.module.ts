import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignLog } from './sign-log.entity';
import { SignController } from './sign.controller';
import { SignService } from './sign.service';
import { User } from '../users/user.entity';
import { ScoreLog } from '../score-shop/entities/score-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SignLog, User, ScoreLog])],
  controllers: [SignController],
  providers: [SignService],
})
export class SignModule {}
