import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BidListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  status?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}
