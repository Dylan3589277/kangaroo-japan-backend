import { IsUUID, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetCouponDto {
  @ApiProperty({ description: '优惠券ID' })
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: '类型' })
  @IsString()
  @IsNotEmpty()
  type: string;
}
