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
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActivityService } from './activity.service';
import { IsString, IsOptional } from 'class-validator';

class SubmitDto {
  @IsOptional()
  @IsString()
  pictures?: string;
  @IsOptional()
  @IsString()
  remark?: string;
}

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Controller('api/v1/activity')
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async submit(@Req() req: AuthenticatedRequest, @Body() dto: SubmitDto) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return await this.service.submit(
      userId,
      dto.pictures || '',
      dto.remark || '',
    );
  }
}
