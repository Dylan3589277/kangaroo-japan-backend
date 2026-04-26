import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class SendSmsDto {
  @IsString()
  @IsNotEmpty()
  mobile: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['bind', 'login', 'verify', 'change'])
  type: string;

  @IsOptional()
  @IsString()
  sign?: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsString()
  code?: string;
}
