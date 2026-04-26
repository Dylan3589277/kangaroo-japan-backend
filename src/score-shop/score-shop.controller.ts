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
import { ScoreShopService } from './score-shop.service';
import { ExchangeDto } from './dto/exchange.dto';
import { GetCouponDto } from './dto/get-coupon.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@ApiTags('积分商城')
@Controller('api/v1/score/shop')
export class ScoreShopController {
  constructor(private readonly scoreShopService: ScoreShopService) {}

  @Post('goods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '积分商品列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async listGoods(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.scoreShopService.listGoods();
    return { success: true, data: result };
  }

  @Post('buy')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '积分兑换商品' })
  @ApiResponse({ status: 200, description: '兑换成功' })
  @ApiResponse({ status: 400, description: '积分不足/库存不足' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '优惠券不存在/用户不存在' })
  async exchangeCoupon(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ExchangeDto,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.scoreShopService.exchangeCoupon(userId, dto.id);
    return { success: true, data: result };
  }

  @Post('getcoupon')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '领取优惠券（免费）' })
  @ApiResponse({ status: 200, description: '领取成功' })
  @ApiResponse({ status: 400, description: '已领取过/库存不足' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '优惠券不存在' })
  async getCoupon(
    @Req() req: AuthenticatedRequest,
    @Body() dto: GetCouponDto,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.scoreShopService.getCoupon(userId, dto.id, dto.type);
    return { success: true, data: result };
  }
}
