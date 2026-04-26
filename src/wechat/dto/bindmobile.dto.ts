import { IsNotEmpty, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class BindMobileDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  mobile: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(6)
  code: string;

  @IsOptional()
  @IsString()
  inviteCode?: string;
}
