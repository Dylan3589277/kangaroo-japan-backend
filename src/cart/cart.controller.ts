import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { CartService } from "./cart.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("api/v1/cart")
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Request() req) {
    return this.cartService.getCart(req.user.id);
  }

  @Post("items")
  async addItem(
    @Request() req,
    @Body() body: { productId: string; quantity?: number },
  ) {
    return this.cartService.addItem(req.user.id, body.productId, body.quantity);
  }

  @Put("items/:id")
  async updateItem(
    @Request() req,
    @Param("id") id: string,
    @Body("quantity") quantity: number,
  ) {
    return this.cartService.updateItem(id, req.user.id, quantity);
  }

  @Delete("items/:id")
  async removeItem(@Request() req, @Param("id") id: string) {
    return this.cartService.removeItem(id, req.user.id);
  }

  @Delete()
  async clearCart(@Request() req) {
    return this.cartService.clearCart(req.user.id);
  }
}
