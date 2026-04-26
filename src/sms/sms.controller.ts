import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SmsService } from './sms.service';
import { SendSmsDto } from './dto/send-sms.dto';

@Controller('api/v1/sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  /**
   * 发送短信验证码
   * POST /api/v1/sms/send
   * 参考PHP Login.php sendsms() 方法
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('send')
  @HttpCode(HttpStatus.OK)
  async send(@Body() dto: SendSmsDto) {
    try {
      await this.smsService.sendSms({
        mobile: dto.mobile,
        type: dto.type,
        sign: dto.sign,
        time: dto.time,
        code: dto.code,
      });

      return {
        success: true,
        message: '发送成功，请注意查收',
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: (error as Error).message || '发送失败',
        },
      };
    }
  }

  /**
   * 获取国际区号列表
   * POST /api/v1/sms/codes
   * 参考PHP Login.php codes() 方法
   */
  @Post('codes')
  @HttpCode(HttpStatus.OK)
  async codes() {
    const list = await this.smsService.getCountryCodes();
    return {
      success: true,
      data: list,
    };
  }
}
