import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface WechatSessionResult {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

interface DecryptedData {
  openid?: string;
  nickName?: string;
  avatarUrl?: string;
  gender?: number;
  city?: string;
  province?: string;
  country?: string;
  unionId?: string;
  phoneNumber?: string;
  purePhoneNumber?: string;
  countryCode?: string;
  watermark?: {
    appid: string;
    timestamp: number;
  };
}

@Injectable()
export class WechatSdkService {
  private readonly logger = new Logger(WechatSdkService.name);
  private readonly appConfigs: Map<string, { appid: string; secret: string }>;

  constructor(private configService: ConfigService) {
    this.appConfigs = new Map();

    // 默认小程序配置
    const defaultAppid = this.configService.get<string>(
      'WECHAT_APPID_DEFAULT',
      'wx208645d960d3f104',
    );
    const defaultSecret = this.configService.get<string>(
      'WECHAT_APPSECRET_DEFAULT',
      '07dde85838dbb580eb714d461578d012',
    );
    if (defaultAppid && defaultSecret) {
      this.appConfigs.set(defaultAppid, {
        appid: defaultAppid,
        secret: defaultSecret,
      });
    }

    // 袋鼠君小程序（gxsweapp）
    const gxsAppid =
      this.configService.get<string>('WECHAT_APPID_GXS') ||
      'wx208645d960d3f104';
    const gxsSecret =
      this.configService.get<string>('WECHAT_APPSECRET_GXS') ||
      '07dde85838dbb580eb714d461578d012';
    this.appConfigs.set(gxsAppid, { appid: gxsAppid, secret: gxsSecret });

    // 花哥小程序（hwweapp）
    const hwAppid =
      this.configService.get<string>('WECHAT_APPID_HW') ||
      'wx8ea38335fdde32a5';
    const hwSecret =
      this.configService.get<string>('WECHAT_APPSECRET_HW') ||
      'c76e77ffa1c4b1079ca63ee933490b2f';
    this.appConfigs.set(hwAppid, { appid: hwAppid, secret: hwSecret });

    this.logger.log(
      `Loaded ${this.appConfigs.size} WeChat app configurations`,
    );
  }

  getAppConfig(appid: string): { appid: string; secret: string } {
    return (
      this.appConfigs.get(appid) ||
      this.appConfigs.get('wx208645d960d3f104') || {
        appid: 'wx208645d960d3f104',
        secret: '07dde85838dbb580eb714d461578d012',
      }
    );
  }

  /**
   * 小程序登录 - code2session
   * https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/login/auth.code2Session.html
   */
  async code2session(
    code: string,
    appid?: string,
  ): Promise<WechatSessionResult> {
    const config = this.getAppConfig(appid || '');
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${config.appid}&secret=${config.secret}&js_code=${code}&grant_type=authorization_code`;

    try {
      const response = await fetch(url);
      return (await response.json()) as WechatSessionResult;
    } catch (error) {
      this.logger.error(`code2session failed: ${(error as Error).message}`);
      return { errcode: -1, errmsg: (error as Error).message };
    }
  }

  /**
   * 解密微信加密数据
   * https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html
   */
  decryptData(
    encryptedData: string,
    iv: string,
    sessionKey: string,
    expectedAppid?: string,
  ): { errcode: number; data?: DecryptedData; errmsg?: string } {
    try {
      if (Buffer.from(sessionKey, 'base64').length !== 24) {
        return { errcode: 1, errmsg: 'sessionKey 错误' };
      }
      if (Buffer.from(iv, 'base64').length !== 24) {
        return { errcode: 2, errmsg: 'iv 错误' };
      }

      const aesKey = Buffer.from(sessionKey, 'base64');
      const aesIV = Buffer.from(iv, 'base64');
      const aesCipher = Buffer.from(encryptedData, 'base64');

      const decipher = crypto.createDecipheriv('aes-128-cbc', aesKey, aesIV);
      decipher.setAutoPadding(true);
      let decoded = decipher.update(aesCipher);
      decoded = Buffer.concat([decoded, decipher.final()]);

      const decodedStr = decoded.toString('utf8');
      const data = JSON.parse(decodedStr) as DecryptedData;

      if (
        expectedAppid &&
        data.watermark?.appid &&
        data.watermark.appid !== expectedAppid
      ) {
        return { errcode: 3, errmsg: 'appid 不匹配' };
      }

      return { errcode: 0, data };
    } catch (error) {
      this.logger.error(`decryptData failed: ${(error as Error).message}`);
      return { errcode: 99, errmsg: '解密失败' };
    }
  }
}
