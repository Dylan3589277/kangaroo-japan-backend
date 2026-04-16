import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * GET /cart - Get user's cart
   */
  @Get()
  async getCart(@Request() req) {
    return this.cartService.getCart(req.user.id);
  }

  /**
   * POST /cart/items - Add item to cart
   */
  @Post('items')
  async addItem(
    @Request() req,
    @Body()
    body: {
      productId: string;
      quantity?: number;
      options?: Record<string, any>;
      buyerMessage?: string;
    },
  ) {
    return this.cartService.addItem(
      req.user.id,
      body.productId,
      body.quantity,
      body.options,
      body.buyerMessage,
    );
  }

  /**
   * PUT /cart/items/:id - Update cart item
   */
  @Put('items/:id')
  async updateItem(
    @Request() req,
    @Param('id') id: string,
    @Body()
    body: {
      quantity?: number;
      options?: Record<string, any>;
      buyerMessage?: string;
    },
  ) {
    return this.cartService.updateItem(id, req.user.id, body);
  }

  /**
   * DELETE /cart/items/:id - Remove item from cart
   */
  @Delete('items/:id')
  async removeItem(@Request() req, @Param('id') id: string) {
    return this.cartService.removeItem(id, req.user.id);
  }

  /**
   * DELETE /cart/items - Clear cart
   */
  @Delete('items')
  async clearCart(@Request() req) {
    return this.cartService.clearCart(req.user.id);
  }

  /**
   * POST /cart/calculate - Calculate shipping and totals
   */
  @Post('calculate')
  async calculate(@Request() req, @Query('addressId') addressId?: string) {
    return this.cartService.calculate(req.user.id, addressId);
  }
}
