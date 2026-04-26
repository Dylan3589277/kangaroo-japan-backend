import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OrdersQueryDto {
  @IsOptional()
  @IsString()
  kwtype?: string;

  @IsOptional()
  @IsString()
  kw?: string;
}

export class IndexQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number = 3;

  @IsOptional()
  @IsString()
  kw?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  uid?: number;

  @IsOptional()
  @IsString()
  shop?: string;
}

export class InstoreDto {
  @IsString()
  ids: string;

  @Type(() => Number)
  weight: number;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  after_post_fee?: string;
}

export class CancelstoreDto {
  @IsString()
  id: string;
}

export class ShipsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  kw?: string;
}

export class CheckshipDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  uid?: string;
}

export class ConfirmShipDto {
  @IsString()
  id: string;

  @Type(() => Number)
  weight: number;

  @Type(() => Number)
  post_fee: number;

  @Type(() => Number)
  pack_fee: number;

  @Type(() => Number)
  amount: number;
}

export class DoshipDto {
  @IsString()
  id: string;

  @IsString()
  post_code: string;
}

export class AddPhotosDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  pictures?: string;
}
