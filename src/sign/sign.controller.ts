import {
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SignService } from './sign.service';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@ApiTags('签到')
@Controller('api/v1/sign')
export class SignController {
  constructor(private readonly signService: SignService) {}

  @Get('index')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取签到信息' })
  @ApiResponse({ status: 200, description: '签到信息' })
  @ApiResponse({ status: 401, description: '未授权' })
  async index(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const data = await this.signService.getSignInfo(userId);
    return { code: 0, data };
  }

  @Post('sign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '执行签到' })
  @ApiResponse({ status: 200, description: '签到结果' })
  @ApiResponse({ status: 401, description: '未授权' })
  async sign(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return await this.signService.doSign(userId);
  }
}
