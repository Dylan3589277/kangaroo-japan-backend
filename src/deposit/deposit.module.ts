import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deposit } from './deposit.entity';
import { DepositService } from './deposit.service';
import { DepositController } from './deposit.controller';
import { User } from '../users/user.entity';
import { Payment } from '../payments/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deposit, User, Payment]),
  ],
  providers: [DepositService],
  controllers: [DepositController],
  exports: [DepositService],
})
export class DepositModule {}
