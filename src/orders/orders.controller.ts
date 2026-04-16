import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("api/v1/orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async getOrders(@Request() req) {
    return this.ordersService.findByUser(req.user.id);
  }

  @Get(":id")
  async getOrder(@Request() req, @Param("id") id: string) {
    return this.ordersService.findById(id, req.user.id);
  }

  @Post()
  async createOrder(
    @Request() req,
    @Body()
    body: {
      addressId: string;
      paymentMethod: string;
      items: { productId: string; quantity: number; price: number; platform: string }[];
      currency?: string;
      shippingFee?: number;
    },
  ) {
    return this.ordersService.create(req.user.id, body);
  }

  @Put(":id/cancel")
  async cancelOrder(@Request() req, @Param("id") id: string) {
    return this.ordersService.cancel(id, req.user.id);
  }
}
