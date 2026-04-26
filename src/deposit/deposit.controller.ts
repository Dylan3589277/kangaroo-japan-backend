import {
  Controller,
  Post,
  Get,
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
import { DepositService } from './deposit.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { ListDepositDto } from './dto/list-deposit.dto';
import { RefundDepositDto } from './dto/refund-deposit.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@ApiTags('押金')
@Controller('api/v1/deposit')
export class DepositController {
  constructor(private readonly depositService: DepositService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '创建押金充值订单' })
  @ApiResponse({ status: 200, description: '创建成功' })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async createDeposit(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateDepositDto,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.depositService.createDeposit(userId, dto.amount);
    return { success: true, data: result };
  }

  @Post('list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '押金记录列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async listDeposits(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ListDepositDto,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const result = await this.depositService.listDeposits(userId, page, limit);
    return { success: true, data: result };
  }

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '押金余额查询' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async getBalance(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.depositService.getBalance(userId);
    return { success: true, data: result };
  }

  @Post('refund')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '押金退款申请' })
  @ApiResponse({ status: 200, description: '申请成功' })
  @ApiResponse({ status: 400, description: '参数错误/押金不足/有未处理申请' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async refundDeposit(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RefundDepositDto,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const result = await this.depositService.refundDeposit(
      userId,
      dto.amount,
      dto.alipayNo,
      dto.alipayRealname,
    );
    return { success: true, data: result };
  }
}
