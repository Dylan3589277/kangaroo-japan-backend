import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { YahooGoodsService } from './yahoo.goods.service';
import { YahooBidService } from './yahoo.bid.service';
import { GoodsListDto } from './dto/goods-list.dto';
import { CreateBidDto } from './dto/create-bid.dto';
import { BidListDto } from './dto/bid-list.dto';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Controller('api/v1/yahoo')
export class YahooController {
  constructor(
    private goodsService: YahooGoodsService,
    private bidService: YahooBidService,
  ) {}

  @Get('goods')
  @HttpCode(HttpStatus.OK)
  async goodsList(@Query() dto: GoodsListDto) {
    const result = await this.goodsService.list(dto);
    return { code: 0, data: result };
  }

  @Get('goods/:goodsNo')
  @HttpCode(HttpStatus.OK)
  async goodsDetail(
    @Param('goodsNo') goodsNo: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    const detail = await this.goodsService.detail(goodsNo, userId);
    if (!detail) {
      return { code: 1, errmsg: '商品不存在' };
    }
    return { code: 0, data: detail };
  }

  @Post('bid')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async bid(@Req() req: AuthenticatedRequest, @Body() dto: CreateBidDto) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.bidService.bid(userId, dto.goodsNo, dto.money);
    return result;
  }

  @Get('bids/list')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async bidList(@Req() req: AuthenticatedRequest, @Query() dto: BidListDto) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.bidService.list(
      userId,
      dto.status || 0,
      dto.page || 1,
    );
    return { code: 0, data: result };
  }
}
