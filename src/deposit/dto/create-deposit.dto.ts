import { IsInt, Min, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDepositDto {
  @ApiProperty({ description: '充值金额（整数，单位：元）', example: 500 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ description: '备注', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}
