import { Controller, Get, Param, UseGuards, Req } from "@nestjs/common";
import { Request } from "express";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}

@Controller("api/v1/users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /api/v1/users/me - 获取当前用户信息
  @Get("me")
  async getCurrentUser(@Req() req: AuthenticatedRequest) {
    return this.usersService.findById(req.user.id);
  }

  @Get(":id")
  async getProfile(@Param("id") id: string) {
    return this.usersService.findById(id);
  }

  @Get(":id/addresses")
  async getAddresses(@Param("id") id: string) {
    return this.usersService.getAddresses(id);
  }
}
