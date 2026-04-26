import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type Redis from 'ioredis';

import { WechatSdkService } from './wechat-sdk.service';
import { UserProvider } from './user-provider.entity';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { REDIS_CLIENT } from '../auth/redis.constants';
import { OAuth2Client } from 'google-auth-library';

// 小程序appid -> source映射
const APPID_SOURCE_MAP: Record<string, string> = {
  wx208645d960d3f104: 'gxsweapp',
  wx8ea38335fdde32a5: 'hwweapp',
};

@Injectable()
export class WechatService {
  private readonly logger = new Logger(WechatService.name);

  // 临时Token有效期：30分钟（未绑定手机号）
  private readonly TEMP_TOKEN_EXPIRY = '30m';
  // 正式Token续期
  private readonly REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

  constructor(
    @InjectRepository(UserProvider)
    private userProviderRepository: Repository<UserProvider>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private wechatSdk: WechatSdkService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private dataSource: DataSource,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  /**
   * 检查session_code是否有效
   */
  async checkWeapp(sessionCode: string): Promise<boolean> {
    const provider = await this.userProviderRepository.findOne({
      where: { sessionCode },
    });
    return !!provider;
  }

  /**
   * 微信小程序授权登录（weapp接口）
   * 解密encryptedData获取用户信息
   */
  async weappLogin(params: {
    code: string;
    encryptedData: string;
    iv: string;
    appid?: string;
    type?: string;
  }) {
    const { code, encryptedData, iv, appid, type } = params;
    const appConfig = this.wechatSdk.getAppConfig(appid || '');

    // 1. code2session换取openid/session_key
    const sessionResult = await this.wechatSdk.code2session(code, appid);
    if (!sessionResult.openid) {
      throw new BadRequestException(
        sessionResult.errmsg || '微信登录失败',
      );
    }

    // 2. 解密用户信息
    const decryptResult = this.wechatSdk.decryptData(
      encryptedData,
      iv,
      sessionResult.session_key!,
      appConfig.appid,
    );
    if (decryptResult.errcode !== 0 || !decryptResult.data) {
      throw new BadRequestException('解密失败，请退出重试一次');
    }

    const userInfo = decryptResult.data;
    const openid = sessionResult.openid;
    const unionid = sessionResult.unionid || userInfo.unionId || '';
    const source = APPID_SOURCE_MAP[appConfig.appid] || 'weapp';

    // 3. 查找或创建user_provider记录
    const provider = await this.findOrCreateProvider({
      openid,
      unionid,
      nickname: userInfo.nickName || '',
      avatarUrl: userInfo.avatarUrl || '',
      sessionCode: code,
      sessionKey: sessionResult.session_key!,
      type: type || source,
    });

    // 4. 判断是否已绑定用户
    if (provider.userId) {
      // 已绑定手机号 → 直接登录
      const user = await this.userRepository.findOne({
        where: { id: provider.userId, status: 'active' as any },
      });
      if (!user) {
        throw new UnauthorizedException('用户状态异常');
      }

      await this.usersService.updateLastLogin(user.id);
      const tokens = await this.generateUserTokens(user);

      return {
        mobile: 1,
        token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        user: {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
      };
    }

    // 5. 未绑定手机号 → 生成临时token
    const tempToken = this.generateTempToken(provider);

    return {
      mobile: 0,
      token: tempToken,
    };
  }

  /**
   * 微信公众号/H5登录（wechat接口）
   * 仅获取openid，不需要解密encryptedData
   */
  async wechatLogin(params: { code: string; appid?: string }) {
    const { code, appid } = params;
    const appConfig = this.wechatSdk.getAppConfig(appid || '');

    const sessionResult = await this.wechatSdk.code2session(code, appid);
    if (!sessionResult.openid) {
      throw new BadRequestException(
        sessionResult.errmsg || '微信登录失败',
      );
    }

    const openid = sessionResult.openid;
    const unionid = sessionResult.unionid || '';
    const source = APPID_SOURCE_MAP[appConfig.appid] || 'weapp';

    // 查找或创建provider
    const provider = await this.findOrCreateProvider({
      openid,
      unionid,
      nickname: '',
      avatarUrl: '',
      sessionCode: code,
      sessionKey: sessionResult.session_key || '',
      type: source,
    });

    // 已绑定用户 → 直接登录
    if (provider.userId) {
      const user = await this.userRepository.findOne({
        where: { id: provider.userId, status: 'active' as any },
      });
      if (!user) {
        throw new UnauthorizedException('用户状态异常');
      }

      await this.usersService.updateLastLogin(user.id);
      const tokens = await this.generateUserTokens(user);

      return {
        mobile: 1,
        token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        user: {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
      };
    }

    // 未绑定 → 临时token
    const tempToken = this.generateTempToken(provider);

    return {
      mobile: 0,
      token: tempToken,
    };
  }

  /**
   * 绑定微信手机号
   */
  async bindWxPhone(params: {
    token: string;
    code: string;
    encryptedData: string;
    iv: string;
    appid?: string;
  }) {
    const { token, code, encryptedData, iv, appid } = params;
    const appConfig = this.wechatSdk.getAppConfig(appid || '');

    // 1. 验证临时token
    const payload = this.verifyTempToken(token);
    if (!payload) {
      throw new UnauthorizedException('无效的TOKEN');
    }

    // 2. 查找provider
    const provider = await this.userProviderRepository.findOne({
      where: { id: payload.sub },
    });
    if (!provider || provider.userId) {
      throw new UnauthorizedException('无效的TOKEN');
    }

    const userKey = crypto.createHash('md5').update(provider.providerUserId).digest('hex');
    if (userKey !== payload.user_key) {
      throw new UnauthorizedException('无效的TOKEN');
    }

    // 3. code2session
    const sessionResult = await this.wechatSdk.code2session(code, appid);
    if (!sessionResult.session_key) {
      throw new BadRequestException(
        sessionResult.errmsg || '登录失败',
      );
    }

    // 4. 解密手机号
    const decryptResult = this.wechatSdk.decryptData(
      encryptedData,
      iv,
      sessionResult.session_key!,
      appConfig.appid,
    );
    if (decryptResult.errcode !== 0 || !decryptResult.data) {
      throw new BadRequestException('解密失败，请稍后再试');
    }

    const phoneNumber =
      decryptResult.data.phoneNumber ||
      decryptResult.data.purePhoneNumber;
    if (!phoneNumber) {
      throw new BadRequestException('解密失败，请稍后再试');
    }

    // 5. 绑定手机号
    const { tokens } = await this.bindProviderToUser(provider, phoneNumber);

    return {
      token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
    };
  }

  /**
   * 绑定手机号（短信验证码方式）
   */
  async bindMobile(params: {
    token: string;
    mobile: string;
    code: string;
    inviteCode?: string;
  }) {
    const { token, mobile, code, inviteCode } = params;

    // 1. 验证临时token
    const payload = this.verifyTempToken(token);
    if (!payload) {
      throw new UnauthorizedException('无效的TOKEN');
    }

    // 2. 查找provider
    const provider = await this.userProviderRepository.findOne({
      where: { id: payload.sub },
    });
    if (!provider || provider.userId) {
      throw new UnauthorizedException('无效的TOKEN');
    }

    const userKey = crypto.createHash('md5').update(provider.providerUserId).digest('hex');
    if (userKey !== payload.user_key) {
      throw new UnauthorizedException('无效的TOKEN');
    }

    // 3. 验证短信验证码
    // SMS验证在controller中已完成，这里直接进行绑定

    // 4. 处理手机号格式
    const cleanMobile = mobile.replace('+86', '');

    // 5. 绑定
    const { tokens } = await this.bindProviderToUser(
      provider,
      cleanMobile,
      inviteCode,
    );

    return {
      token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
    };
  }

  /**
   * 查找或创建user_provider记录
   */
  private async findOrCreateProvider(params: {
    openid: string;
    unionid: string;
    nickname: string;
    avatarUrl: string;
    sessionCode: string;
    sessionKey: string;
    type: string;
  }): Promise<UserProvider> {
    const { openid, unionid, nickname, avatarUrl, sessionCode, sessionKey, type } = params;

    // 优先通过unionid查找
    let provider: UserProvider | null = null;
    if (unionid) {
      provider = await this.userProviderRepository.findOne({
        where: { provider: 'wechat', unionid },
      });
    }

    // 通过openid查找
    if (!provider) {
      provider = await this.userProviderRepository.findOne({
        where: { provider: 'wechat', providerUserId: openid },
      });
    }

    if (provider) {
      // 更新session信息
      provider.sessionCode = sessionCode;
      if (sessionKey) {
        provider.sessionKeyEncrypted = this.encryptSessionKey(sessionKey);
      }
      if (nickname) provider.name = nickname;
      if (avatarUrl) provider.avatarUrl = avatarUrl;
      if (type) provider.type = type;
      if (unionid && !provider.unionid) provider.unionid = unionid;

      return this.userProviderRepository.save(provider);
    }

    // 创建新记录
    const newProvider = this.userProviderRepository.create({
      provider: 'wechat',
      providerUserId: openid,
      unionid: unionid || undefined,
      name: nickname || `用户${crypto.randomBytes(3).toString('hex')}`,
      avatarUrl: avatarUrl || undefined,
      type,
      sessionCode,
      sessionKeyEncrypted: this.encryptSessionKey(sessionKey),
      rawMetadata: params as any,
    });

    return this.userProviderRepository.save(newProvider);
  }

  /**
   * 绑定provider到user
   */
  private async bindProviderToUser(
    provider: UserProvider,
    mobile: string,
    inviteCode?: string,
  ): Promise<{ user: User; tokens: any }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 查找是否已有该手机号的用户
      let user = await queryRunner.manager.findOne(User, {
        where: { phone: mobile },
      });

      if (user) {
        // 已有用户 → 关联provider
        provider.userId = user.id;
        await queryRunner.manager.save(provider);

        user.lastLoginAt = new Date();
        await queryRunner.manager.save(user);
      } else {
        // 新用户 → 创建
        const newUser = queryRunner.manager.create(User, {
          phone: mobile,
          name: provider.name || `用户${crypto.randomBytes(3).toString('hex')}`,
          avatarUrl: provider.avatarUrl,
        });
        user = await queryRunner.manager.save(newUser);

        provider.userId = user.id;
        await queryRunner.manager.save(provider);

        // 邀请码逻辑（后续实现）
        // if (inviteCode) { ... }
      }

      await queryRunner.commitTransaction();

      const tokens = await this.generateUserTokens(user);

      return { user, tokens };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`bindProviderToUser failed: ${(error as Error).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 生成临时token（未绑定手机号时使用）
   */
  private generateTempToken(provider: UserProvider): string {
    const userKey = crypto
      .createHash('md5')
      .update(provider.providerUserId)
      .digest('hex');

    return this.jwtService.sign(
      {
        sub: provider.id,
        type: 'provider_token',
        user_key: userKey,
      },
      { expiresIn: this.TEMP_TOKEN_EXPIRY },
    );
  }

  /**
   * 验证临时token
   */
  private verifyTempToken(token: string): any {
    try {
      const payload = this.jwtService.verify(token);
      if (payload.type !== 'provider_token') {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * 生成用户正式token
   */
  private async generateUserTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'user_token',
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = uuidv4();
    await this.redis.set(
      `refresh_token:${refreshToken}`,
      JSON.stringify({ userId: user.id }),
      'EX',
      this.REFRESH_TOKEN_TTL_SECONDS,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900,
    };
  }

  /**
   * 谷歌OAuth登录
   * POST /api/v1/wechat/google
   * 接收Google ID Token，解析用户信息
   */
  async googleLogin(params: { idToken: string; clientId?: string }) {
    const { idToken, clientId } = params;

    // 1. 验证Google ID Token
    const googleClient = new OAuth2Client(
      clientId || this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );

    let payload: any;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: clientId || this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });
      payload = ticket.getPayload();
    } catch (error) {
      this.logger.error(`Google token verification failed: ${(error as Error).message}`);
      throw new BadRequestException('Google登录验证失败');
    }

    if (!payload || !payload.sub) {
      throw new BadRequestException('Google登录验证失败');
    }

    const googleUserId = payload.sub;
    const email = payload.email || '';
    const name = payload.name || payload.given_name || `Google用户${crypto.randomBytes(3).toString('hex')}`;
    const avatarUrl = payload.picture || '';

    // 2. 查找或创建user_provider记录
    const provider = await this.findOrCreateGoogleProvider({
      googleUserId,
      email,
      name,
      avatarUrl,
    });

    // 3. 判断是否已绑定用户
    if (provider.userId) {
      // 已绑定手机号 → 直接登录
      const user = await this.userRepository.findOne({
        where: { id: provider.userId, status: 'active' as any },
      });
      if (!user) {
        throw new UnauthorizedException('用户状态异常');
      }

      await this.usersService.updateLastLogin(user.id);
      const tokens = await this.generateUserTokens(user);

      return {
        mobile: 1,
        token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        user: {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
      };
    }

    // 4. 未绑定手机号 → 生成临时token
    const tempToken = this.generateTempToken(provider);

    return {
      mobile: 0,
      token: tempToken,
    };
  }

  /**
   * 查找或创建Google provider记录
   */
  private async findOrCreateGoogleProvider(params: {
    googleUserId: string;
    email: string;
    name: string;
    avatarUrl: string;
  }): Promise<UserProvider> {
    const { googleUserId, email, name, avatarUrl } = params;

    // 通过google的sub(id)查找
    let provider = await this.userProviderRepository.findOne({
      where: { provider: 'google', providerUserId: googleUserId },
    });

    if (provider) {
      // 更新信息
      if (name) provider.name = name;
      if (avatarUrl) provider.avatarUrl = avatarUrl;
      if (email) {
        provider.rawMetadata = { ...(provider.rawMetadata || {}), email };
      }

      return this.userProviderRepository.save(provider);
    }

    // 创建新记录
    const newProvider = this.userProviderRepository.create({
      provider: 'google',
      providerUserId: googleUserId,
      name,
      avatarUrl: avatarUrl || undefined,
      type: 'google',
      rawMetadata: { email } as any,
    });

    return this.userProviderRepository.save(newProvider);
  }

  /**
   * session_key加密存储
   */
  private encryptSessionKey(sessionKey: string): string {
    // 简单的base64编码存储，生产环境应使用AES加密
    return Buffer.from(sessionKey).toString('base64');
  }
}
