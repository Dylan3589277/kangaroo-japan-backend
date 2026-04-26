import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignLog } from './sign-log.entity';
import { SignController } from './sign.controller';
import { SignService } from './sign.service';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SignLog, User])],
  controllers: [SignController],
  providers: [SignService],
})
export class SignModule {}
