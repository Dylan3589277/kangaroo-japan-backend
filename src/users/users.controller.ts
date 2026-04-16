import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("api/v1/users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(":id")
  async getProfile(@Param("id") id: string) {
    return this.usersService.findById(id);
  }

  @Get(":id/addresses")
  async getAddresses(@Param("id") id: string) {
    return this.usersService.getAddresses(id);
  }
}
