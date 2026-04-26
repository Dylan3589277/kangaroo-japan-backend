import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BindWxPhoneDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  encryptedData: string;

  @IsString()
  @IsNotEmpty()
  iv: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  appid?: string;
}
