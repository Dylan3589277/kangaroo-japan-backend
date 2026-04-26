import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class WechatLoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  appid?: string;
}
