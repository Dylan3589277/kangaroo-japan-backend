import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CommunityListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsString()
  kw?: string;
}

export class CommunitySubmitDto {
  @IsOptional()
  @IsString()
  pictures?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class CommunityCancelDto {
  @IsString()
  id: string;
}
