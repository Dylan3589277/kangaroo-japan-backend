import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';
import { ShipmentOrder } from './entities/shipment-order.entity';
import { OrderPhoto } from './entities/order-photo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ShipmentOrder, OrderPhoto])],
  controllers: [WarehouseController],
  providers: [WarehouseService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
