import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { TranslateService } from './translate.service';
import { IsString } from 'class-validator';

class TranslateDto {
  @IsString()
  src: string;
}

@Controller('api/v1/translate')
export class TranslateController {
  constructor(private readonly service: TranslateService) {}

  @Post('jp2zh')
  @HttpCode(HttpStatus.OK)
  async jp2zh(
    @Body() dto: TranslateDto,
  ): Promise<{ code: number; errmsg: string; data?: unknown }> {
    return await this.service.jp2zh(dto.src);
  }
}
