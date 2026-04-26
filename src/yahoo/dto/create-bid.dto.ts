import { IsString, IsNumber, Min } from 'class-validator';

export class CreateBidDto {
  @IsString()
  goodsNo: string;

  @IsNumber()
  @Min(1)
  money: number;
}
