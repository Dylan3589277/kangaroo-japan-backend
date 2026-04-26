import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('api/v1/chat')
export class ChatController {
  constructor(private readonly service: ChatService) {}

  @Get('kefu')
  @HttpCode(HttpStatus.OK)
  getKefu(@Query('gid') gid: string, @Query('shop') shop: string) {
    const data = this.service.getKefuUrl(gid || '', shop || '');
    return { code: 0, data };
  }
}
