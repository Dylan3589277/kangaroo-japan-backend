import { IsString, IsNumber } from 'class-validator';

export class DeliveryFeeDto {
  @IsString()
  goodsNo: string;

  @IsNumber()
  price: number;

  @IsString()
  address: string;
}
