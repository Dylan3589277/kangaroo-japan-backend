import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StripeService } from './stripe.service';
import { PingxxService } from './pingxx.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    OrdersModule,
  ],
  providers: [PaymentsService, StripeService, PingxxService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
