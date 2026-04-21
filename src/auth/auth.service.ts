import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import {
  User,
  PreferredLanguage,
  PreferredCurrency,
} from '../users/user.entity';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.passwordHash) {
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (isValid) {
        return user;
      }
    }
    return null;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    const tokens = await this.generateTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async register(data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    preferredLanguage?: string;
    preferredCurrency?: string;
  }) {
    // Check if email or phone already exists
    const exists = await this.usersService.checkEmailOrPhoneExists(
      data.email,
      data.phone,
    );
    if (exists) {
      throw new ConflictException('Email or phone already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.create({
      email: data.email,
      phone: data.phone,
      passwordHash,
      name: data.name,
      preferredLanguage: data.preferredLanguage as PreferredLanguage,
      preferredCurrency: data.preferredCurrency as PreferredCurrency,
    });

    // Create empty cart for new user (handled by DB trigger in production)
    const tokens = await this.generateTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async logout(refreshToken: string) {
    await this.redis.del(`refresh_token:${refreshToken}`);
    return { message: 'Logged out successfully' };
  }

  async refresh(refreshToken: string) {
    // Atomically get-and-delete the token to prevent replay attacks.
    // A Lua script executes as a single Redis command, so concurrent requests
    // cannot both claim the same token — only the first call succeeds.
    const raw = (await this.redis.eval(
      `local v = redis.call('GET', KEYS[1])
if not v then return nil end
redis.call('DEL', KEYS[1])
return v`,
      1,
      `refresh_token:${refreshToken}`,
    )) as string | null;

    if (!raw) {
      throw new UnauthorizedException('Invalid or already used refresh token');
    }

    let tokenData: { userId: string };
    try {
      tokenData = JSON.parse(raw) as { userId: string };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.usersService.findById(tokenData.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Old token already consumed atomically above; issue new token pair.
    const tokens = await this.generateTokens(user);
    return tokens;
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitizeUser(user);
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = uuidv4();
    await this.redis.set(
      `refresh_token:${refreshToken}`,
      JSON.stringify({ userId: user.id }),
      'EX',
      REFRESH_TOKEN_TTL_SECONDS,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15 minutes in seconds
    };
  }

  private sanitizeUser(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return result;
  }

  // Helper to generate token pairs for response
  generateTokenPair(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      expires_in: 900,
    };
  }
}
