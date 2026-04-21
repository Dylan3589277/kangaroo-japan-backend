import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Response, Request } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RegisterDto, LoginDto } from "./dto/auth.dto";

@Controller("api/v1/auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);

    // Set refresh token in HttpOnly cookie
    this.setRefreshTokenCookie(res, result.refresh_token);

    // Return user and access token
    return {
      success: true,
      data: {
        user: result.user,
        tokens: {
          access_token: result.access_token,
          expires_in: result.expires_in,
        },
      },
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password);

    // Set refresh token in HttpOnly cookie
    this.setRefreshTokenCookie(res, result.refresh_token);

    return {
      success: true,
      data: {
        user: result.user,
        tokens: {
          access_token: result.access_token,
          expires_in: result.expires_in,
        },
      },
    };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear the refresh token cookie
    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return {
      success: true,
      message: "Logged out successfully",
    };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Get refresh token from body or cookie
    const refreshToken = body.refreshToken || req.cookies?.refresh_token;
    if (!refreshToken) {
      return {
        success: false,
        error: { code: "INVALID_REQUEST", message: "Refresh token required" },
      };
    }

    try {
      const tokens = await this.authService.refresh(refreshToken);

      // Set new refresh token in cookie (token rotation)
      this.setRefreshTokenCookie(res, tokens.refresh_token);

      return {
        success: true,
        data: {
          tokens: {
            access_token: tokens.access_token,
            expires_in: tokens.expires_in,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: (error as Error).message || "Invalid refresh token",
        },
      };
    }
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    const user = await this.authService.getProfile(req.user.id);
    return {
      success: true,
      data: { user },
    };
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      path: "/",
    });
  }
}
