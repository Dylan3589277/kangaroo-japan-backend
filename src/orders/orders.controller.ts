import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OrdersService, type CreateOrderDto, type OrderQueryDto } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';

@Controller('api/v1/orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * GET /orders - List user's orders
   */
  @Get()
  async getOrders(@Request() req: any, @Query() query: OrderQueryDto) {
    const { orders, total } = await this.ordersService.findByUser(
      req.user.id,
      query,
    );
    const page = query.page || 1;
    const limit = query.limit || 10;

    return {
      success: true,
      data: orders.map((order) => this.formatOrder(order)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    };
  }

  /**
   * GET /orders/:id - Get order detail
   */
  @Get(':id')
  async getOrder(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const order = await this.ordersService.findById(id, req.user.id);
    return {
      success: true,
      data: this.formatOrderDetail(order),
    };
  }

  /**
   * POST /orders - Create new order
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(@Request() req: any, @Body() body: CreateOrderDto) {
    const order = await this.ordersService.create(req.user.id, body);

    return {
      success: true,
      data: {
        order_id: order.id,
        order_no: order.orderNo,
        status: order.status,
        payment: {
          amount: Number(order.totalAmount),
          currency: order.totalCurrency,
          methods: [
            { type: 'stripe', name: 'Credit Card' },
            { type: 'alipay', name: '支付宝' },
            { type: 'wechat_pay', name: '微信支付' },
          ],
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
        summary: {
          subtotal: Number(order.subtotalCny),
          subtotal_jpy: Number(order.subtotalJpy),
          shipping_fee: Number(order.shippingFeeCny),
          shipping_fee_jpy: Number(order.shippingFeeJpy),
          service_fee: Number(order.serviceFeeCny),
          coupon_discount: Number(order.couponDiscountCny),
          total: Number(order.totalAmount),
          currency: order.totalCurrency,
        },
      },
    };
  }

  /**
   * PUT /orders/:id/cancel - Cancel order
   */
  @Put(':id/cancel')
  async cancelOrder(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const order = await this.ordersService.cancel(id, req.user.id);
    return {
      success: true,
      data: this.formatOrder(order),
      message: 'Order cancelled successfully',
    };
  }

  /**
   * GET /orders/:id/track - Track logistics
   */
  @Get(':id/track')
  async trackOrder(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const tracking = await this.ordersService.track(id, req.user.id);
    return {
      success: true,
      data: tracking,
    };
  }

  /**
   * Format order for list view
   */
  private formatOrder(order: Order) {
    const plainOrder = order as any;
    return {
      id: plainOrder.id,
      order_no: plainOrder.orderNo,
      status: plainOrder.status,
      total_amount: Number(plainOrder.totalAmount),
      total_currency: plainOrder.totalCurrency,
      items_count: plainOrder.items?.length || 0,
      subtotal_jpy: Number(plainOrder.subtotalJpy) || 0,
      subtotal_cny: Number(plainOrder.subtotalCny) || 0,
      shipping_fee_jpy: Number(plainOrder.shippingFeeJpy) || 0,
      shipping_fee_cny: Number(plainOrder.shippingFeeCny) || 0,
      service_fee_jpy: Number(plainOrder.serviceFeeJpy) || 0,
      service_fee_cny: Number(plainOrder.serviceFeeCny) || 0,
      coupon_discount_cny: Number(plainOrder.couponDiscountCny) || 0,
      payment_method: plainOrder.paymentMethod || null,
      paid_at: plainOrder.paidAt || null,
      tracking_number: plainOrder.trackingNumber || null,
      shipping_carrier: plainOrder.shippingCarrier || null,
      shipped_at: plainOrder.shippedAt || null,
      delivered_at: plainOrder.deliveredAt || null,
      estimated_delivery: plainOrder.estimatedDelivery || null,
      created_at: plainOrder.createdAt,
      updated_at: plainOrder.updatedAt,
      items: (plainOrder.items || []).map((item: OrderItem) => this.formatOrderItem(item)),
    };
  }

  /**
   * Format order item
   */
  private formatOrderItem(item: OrderItem) {
    const plain = item as any;
    return {
      id: plain.id,
      product_id: plain.productId,
      title:
        plain.titleZhSnapshot || plain.titleEnSnapshot || plain.titleJaSnapshot || '',
      cover_image: plain.coverImageUrl || null,
      platform: plain.platform,
      quantity: plain.quantity,
      unit_price_jpy: Number(plain.unitPriceJpy) || 0,
      unit_price_cny: Number(plain.unitPriceCny) || 0,
      subtotal_jpy: Number(plain.subtotalJpy) || 0,
      subtotal_cny: Number(plain.subtotalCny) || 0,
      status: plain.status || 'pending',
      tracking_number: plain.trackingNumber || null,
    };
  }

  /**
   * Format order detail with address
   */
  private formatOrderDetail(order: Order) {
    const formatted = this.formatOrder(order);
    const plain = order as any;
    const addr = plain.address;

    return {
      ...formatted,
      address: addr
        ? {
            id: addr.id,
            recipient_name: addr.recipientName || addr.recipient_name || '',
            phone: addr.phone || '',
            country: addr.country || '',
            country_name: this.getCountryName(addr.country || addr.country_name || ''),
            address_line1: addr.addressLine1 || addr.address_line1 || '',
            address_line2: addr.addressLine2 || addr.address_line2 || null,
            city: addr.city || '',
            postal_code: addr.postalCode || addr.postal_code || '',
            full_address_text: addr.fullAddressText || addr.full_address_text || null,
          }
        : null,
      buyer_message: plain.buyerMessage || null,
    };
  }

  private getCountryName(code: string): string {
    const names: Record<string, string> = {
      CN: '中国',
      JP: '日本',
      US: '美国',
      UK: '英国',
      AU: '澳大利亚',
      DE: '德国',
      FR: '法国',
      KR: '韩国',
      TW: '台湾',
      HK: '香港',
      SG: '新加坡',
      CA: '加拿大',
    };
    return names[code] || code;
  }
}
