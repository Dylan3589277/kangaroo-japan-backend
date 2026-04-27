import {
  Controller,
  Get,
  Post,
  Req,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DrawService } from './draw.service';
import { DrawLogsDto } from './dto/draw-logs.dto';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Controller('api/v1/draw')
export class DrawController {
  constructor(private drawService: DrawService) {}

  @Get('index')
  @HttpCode(HttpStatus.OK)
  async index(@Req() req: AuthenticatedRequest) {
    // 如果已登录则带用户积分，未登录则 userScore=0
    if (req.user?.id) {
      const result = await this.drawService.getIndexWithUser(req.user.id);
      return { code: 0, data: result };
    }
    const result = await this.drawService.getIndex();
    return { code: 0, data: result };
  }

  @Post('draw')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async draw(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.drawService.draw(userId);
    return { code: 0, data: result };
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logs(@Req() req: AuthenticatedRequest, @Query() dto: DrawLogsDto) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.drawService.getLogs(userId, dto.page || 1);
    return { code: 0, data: result };
  }
}
