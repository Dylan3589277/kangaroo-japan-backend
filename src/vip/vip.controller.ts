import {
  Controller,
  Post,
  Body,
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
import { VipService } from './vip.service';
import { BuyVipDto } from './dto/buy-vip.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@ApiTags('VIP会员')
@Controller('api/v1/user')
export class VipController {
  constructor(private readonly vipService: VipService) {}

  /**
   * 获取会员等级列表
   */
  @Post('levels')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取会员等级列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async getLevels(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const result = await this.vipService.getLevels(userId);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 购买VIP会员
   */
  @Post('vipbuy')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '购买VIP会员' })
  @ApiResponse({ status: 200, description: '下单成功' })
  @ApiResponse({ status: 400, description: '请求错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async buyVip(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BuyVipDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const result = await this.vipService.buyVip(userId, dto);

    return {
      success: true,
      data: result,
    };
  }
}
