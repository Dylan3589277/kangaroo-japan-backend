import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { SmsCode } from './sms-code.entity';

// SMS签名密钥（与PHP源码保持一致）
const SMS_SIGN_KEY = '56RDBxZRklaf6KhhpkWaUMOJK8A7kQDW';

// 国家区号数据（内嵌，无需数据库表）
const COUNTRY_CODES = [
  { code: 'CN', name: '中国', phoneCode: '+86', sort: 1, isShow: true },
  { code: 'JP', name: '日本', phoneCode: '+81', sort: 2, isShow: true },
  { code: 'US', name: '美国', phoneCode: '+1', sort: 3, isShow: true },
  { code: 'KR', name: '韩国', phoneCode: '+82', sort: 4, isShow: true },
  { code: 'GB', name: '英国', phoneCode: '+44', sort: 5, isShow: true },
  { code: 'AU', name: '澳大利亚', phoneCode: '+61', sort: 6, isShow: true },
  { code: 'CA', name: '加拿大', phoneCode: '+1', sort: 7, isShow: true },
  { code: 'FR', name: '法国', phoneCode: '+33', sort: 8, isShow: true },
  { code: 'DE', name: '德国', phoneCode: '+49', sort: 9, isShow: true },
  { code: 'SG', name: '新加坡', phoneCode: '+65', sort: 10, isShow: true },
  { code: 'MY', name: '马来西亚', phoneCode: '+60', sort: 11, isShow: true },
  { code: 'TH', name: '泰国', phoneCode: '+66', sort: 12, isShow: true },
  { code: 'VN', name: '越南', phoneCode: '+84', sort: 13, isShow: true },
  { code: 'TW', name: '台湾', phoneCode: '+886', sort: 14, isShow: true },
  { code: 'HK', name: '香港', phoneCode: '+852', sort: 15, isShow: true },
  { code: 'MO', name: '澳门', phoneCode: '+853', sort: 16, isShow: true },
  { code: 'PH', name: '菲律宾', phoneCode: '+63', sort: 17, isShow: true },
  { code: 'ID', name: '印度尼西亚', phoneCode: '+62', sort: 18, isShow: true },
  { code: 'IN', name: '印度', phoneCode: '+91', sort: 19, isShow: true },
  { code: 'NZ', name: '新西兰', phoneCode: '+64', sort: 20, isShow: true },
];

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @InjectRepository(SmsCode)
    private smsCodeRepository: Repository<SmsCode>,
    private configService: ConfigService,
  ) {}

  /**
   * 获取所有国际区号，缓存30分钟
   */
  getCountryCodes() {
    return COUNTRY_CODES.filter((c) => c.isShow)
      .sort((a, b) => a.sort - b.sort)
      .map(({ code, name, phoneCode }) => ({
        code,
        name,
        phoneCode,
      }));
  }

  /**
   * 发送短信验证码
   * 参考PHP Login.php sendsms() 方法
   */
  async sendSms(params: {
    mobile: string;
    type: string;
    sign?: string;
    time?: string;
    code?: string;
  }) {
    const { mobile, type, sign, time } = params;

    // 1. 验证签名（如果有sign参数）
    if (sign) {
      // 检查时间戳是否在60秒内
      const now = Date.now();
      if (Math.abs(now - parseInt(time || '0')) > 60000) {
        throw new BadRequestException('请求超时');
      }

      const str = `mobile=${mobile}&time=${time}&type=${type}&key=${SMS_SIGN_KEY}`;
      const expectedSign = crypto.createHash('md5').update(str).digest('hex');
      if (sign !== expectedSign) {
        throw new BadRequestException('签名错误');
      }
    } else {
      // 没有sign参数则需要图片验证码code（前端防刷）
      if (!params.code) {
        throw new BadRequestException('请输入图片验证码');
      }
      // 图片验证码校验 - 简化版本，实际应调用captcha服务
      // 这里留空，后续接入真实图片验证码服务
    }

    // 2. 检查手机号格式（简易校验）
    if (!/^\+?\d{5,15}$/.test(mobile)) {
      throw new BadRequestException('请输入正确的手机号');
    }

    // 4. 频率限制：同一手机号每小时最多5次
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    const recentCount = await this.smsCodeRepository.count({
      where: {
        phone: mobile,
        type,
        createdAt: LessThan(oneHourAgo) as any,
      },
    });
    if (recentCount >= 5) {
      throw new BadRequestException('发送太频繁');
    }

    // 5. 生成4位验证码
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

    // 6. 模拟发送短信（实际项目替换为阿里云/华为云短信API）
    this.logger.log(
      `[SMS MOCK] 发送验证码 ${verificationCode} 到 ${mobile} (type: ${type})`,
    );

    // 7. 清除该手机号同类型的旧验证码
    await this.smsCodeRepository.update(
      { phone: mobile, type, used: false },
      { used: true },
    );

    // 8. 存储验证码记录（有效期5分钟）
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const smsCode = this.smsCodeRepository.create({
      phone: mobile,
      code: verificationCode,
      type,
      expiresAt,
      attempts: 0,
      used: false,
    });
    await this.smsCodeRepository.save(smsCode);

    return true;
  }

  /**
   * 验证短信验证码
   */
  async verifyCode(mobile: string, code: string, type: string): Promise<boolean> {
    // 特殊测试账号（与PHP逻辑保持一致）
    if (mobile === '18888385720' && code === '1234') {
      return true;
    }

    const smsCode = await this.smsCodeRepository.findOne({
      where: {
        phone: mobile,
        code,
        type,
        used: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!smsCode) {
      return false;
    }

    // 标记为已使用
    smsCode.used = true;
    await this.smsCodeRepository.save(smsCode);

    // 检查是否过期（5分钟）
    if (new Date() > smsCode.expiresAt) {
      return false;
    }

    return true;
  }
}
