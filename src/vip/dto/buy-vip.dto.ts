import { IsInt, Min, Max, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BuyVipDto {
  @ApiProperty({ description: '目标等级ID (2=黄金, 3=铂金, 4=钻石)', example: 2 })
  @IsInt()
  @Min(2)
  @Max(4)
  level: number;

  @ApiProperty({ description: '购买月数 (0=季, 1=半年, 2=年)', example: 0 })
  @IsInt()
  @Min(0)
  month: number;
}
