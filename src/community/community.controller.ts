import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommunityService } from './community.service';
import { CommunityListDto, CommunitySubmitDto, CommunityCancelDto } from './dto/index';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Controller('api/v1/community')
export class CommunityController {
  constructor(private communityService: CommunityService) {}

  @Get('index')
  @HttpCode(HttpStatus.OK)
  async index(@Query() dto: CommunityListDto) {
    const result = await this.communityService.list(dto.page || 1, dto.kw);
    return { code: 0, data: result };
  }

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async submit(@Req() req: AuthenticatedRequest, @Body() dto: CommunitySubmitDto) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.communityService.submit(userId, dto);
    return result;
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async mine(@Req() req: AuthenticatedRequest, @Query() dto: CommunityListDto) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.communityService.mine(userId, dto.page || 1);
    return { code: 0, data: result };
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancel(@Req() req: AuthenticatedRequest, @Body() dto: CommunityCancelDto) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.communityService.cancel(userId, dto.id);
    return result;
  }
}
