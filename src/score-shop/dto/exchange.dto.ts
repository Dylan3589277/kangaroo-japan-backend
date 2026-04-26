import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExchangeDto {
  @ApiProperty({ description: '优惠券ID' })
  @IsUUID()
  @IsNotEmpty()
  id: string;
}
