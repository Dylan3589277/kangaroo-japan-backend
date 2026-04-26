import { IsString } from 'class-validator';

export class GoodsDetailDto {
  @IsString()
  goodsNo: string;
}
