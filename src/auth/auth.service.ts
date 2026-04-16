import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../users/users.service";
import { User } from "../users/user.entity";
import * as bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";

const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";
const ACCESS_TOKEN_COOKIE_NAME = "access_token";

@Injectable()
export class AuthService {
  // In-memory store for refresh tokens (in production, use Redis)
  private refreshTokens = new Map<string, { userId: string; expiresAt: Date }>();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
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
      throw new UnauthorizedException("Invalid credentials");
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
      throw new ConflictException("Email or phone already registered");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.create({
      email: data.email,
      phone: data.phone,
      passwordHash,
      name: data.name,
      preferredLanguage: data.preferredLanguage as any,
      preferredCurrency: data.preferredCurrency as any,
    });

    // Create empty cart for new user (handled by DB trigger in production)
    const tokens = await this.generateTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async logout(refreshToken: string) {
    // Remove refresh token from store
    this.refreshTokens.delete(refreshToken);
    return { message: "Logged out successfully" };
  }

  async refresh(refreshToken: string) {
    const tokenData = this.refreshTokens.get(refreshToken);
    if (!tokenData) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (new Date() > tokenData.expiresAt) {
      this.refreshTokens.delete(refreshToken);
      throw new UnauthorizedException("Refresh token expired");
    }

    const user = await this.usersService.findById(tokenData.userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    // Generate new tokens (token rotation)
    this.refreshTokens.delete(refreshToken);
    const tokens = await this.generateTokens(user);
    return tokens;
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return this.sanitizeUser(user);
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get("JWT_EXPIRES_IN", "15m"),
    });

    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    this.refreshTokens.set(refreshToken, {
      userId: user.id,
      expiresAt,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15 minutes in seconds
    };
  }

  private sanitizeUser(user: User) {
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
