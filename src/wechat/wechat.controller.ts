import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WechatService } from './wechat.service';
import { WeappLoginDto } from './dto/weapp-login.dto';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { BindWxPhoneDto } from './dto/bindwxphone.dto';
import { BindMobileDto } from './dto/bindmobile.dto';
import { GoogleLoginDto } from './dto/google-login.dto';

@Controller('api/v1/wechat')
export class WechatController {
  constructor(private readonly wechatService: WechatService) {}

  /**
   * 检查session_code是否过期
   * POST /api/v1/wechat/checkweapp
   */
  @Post('checkweapp')
  @HttpCode(HttpStatus.OK)
  async checkWeapp(@Body('session_code') sessionCode: string) {
    if (!sessionCode) {
      return { success: false, error: { message: '参数不足' } };
    }

    const valid = await this.wechatService.checkWeapp(sessionCode);
    if (valid) {
      return { success: true };
    }
    return { success: false, error: { message: 'expire' } };
  }

  /**
   * 小程序授权登录
   * POST /api/v1/wechat/weapp
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('weapp')
  @HttpCode(HttpStatus.OK)
  async weappLogin(@Body() dto: WeappLoginDto) {
    try {
      const result = await this.wechatService.weappLogin({
        code: dto.code,
        encryptedData: dto.encryptedData,
        iv: dto.iv,
        appid: dto.appid,
        type: dto.type,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message:
            (error as Error).message || '登录失败，请退出重试一次',
        },
      };
    }
  }

  /**
   * 微信公众号/H5登录
   * POST /api/v1/wechat/wechat
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('wechat')
  @HttpCode(HttpStatus.OK)
  async wechatLogin(@Body() dto: WechatLoginDto) {
    try {
      const result = await this.wechatService.wechatLogin({
        code: dto.code,
        appid: dto.appid,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message:
            (error as Error).message || '登录失败，请退出重试一次',
        },
      };
    }
  }

  /**
   * 绑定微信手机号
   * POST /api/v1/wechat/bindwxphone
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('bindwxphone')
  @HttpCode(HttpStatus.OK)
  async bindWxPhone(@Body() dto: BindWxPhoneDto) {
    try {
      const result = await this.wechatService.bindWxPhone({
        token: dto.token,
        code: dto.code,
        encryptedData: dto.encryptedData,
        iv: dto.iv,
        appid: dto.appid,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: (error as Error).message || '绑定失败',
        },
      };
    }
  }

  /**
   * 绑定手机号（短信验证码）
   * POST /api/v1/wechat/bindmobile
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('bindmobile')
  @HttpCode(HttpStatus.OK)
  async bindMobile(@Body() dto: BindMobileDto) {
    try {
      const result = await this.wechatService.bindMobile({
        token: dto.token,
        mobile: dto.mobile,
        code: dto.code,
        inviteCode: dto.inviteCode,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: (error as Error).message || '绑定失败',
        },
      };
    }
  }

  /**
   * 谷歌OAuth登录
   * POST /api/v1/wechat/google
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() dto: GoogleLoginDto) {
    try {
      const result = await this.wechatService.googleLogin({
        idToken: dto.idToken,
        clientId: dto.clientId,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message:
            (error as Error).message || 'Google登录失败',
        },
      };
    }
  }
}
