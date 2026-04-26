import { IsInt, Min, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefundDepositDto {
  @ApiProperty({ description: '退款金额（整数，单位：元）', example: 500 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ description: '支付宝账号', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  alipayNo?: string;

  @ApiPropertyOptional({ description: '支付宝实名', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  alipayRealname?: string;
}
