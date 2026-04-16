import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order, OrderStatus } from './order.entity';
import { OrderItem } from './order-item.entity';
import { CartService } from '../cart/cart.service';
import { Product } from '../products/product.entity';

// Exchange rate fallback (should come from exchange service)
const JPY_TO_CNY_RATE = 0.05;

export interface CreateOrderDto {
  addressId: string;
  currency?: string;
  items: { cartItemId?: string; productId?: string; quantity?: number }[];
  buyerMessage?: string;
  couponCode?: string;
}

export interface OrderQueryDto {
  status?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private cartService: CartService,
  ) {}

  /**
   * Generate unique order number: DSJ + YYYYMMDD + 6-digit sequence
   */
  private async generateOrderNo(): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count orders created today for sequence
    const countToday = await this.ordersRepository.count({
      where: {
        createdAt: new Date(today),
      },
    });

    const seq = String(countToday + 1).padStart(6, '0');
    return `DSJ${dateStr}${seq}`;
  }

  /**
   * Get exchange rate (fallback to JPY_TO_CNY_RATE)
   */
  private getExchangeRate(from: string, to: string): number {
    if (from === to) return 1;
    if (from === 'JPY' && to === 'CNY') return JPY_TO_CNY_RATE;
    if (from === 'CNY' && to === 'JPY') return 1 / JPY_TO_CNY_RATE;
    if (from === 'USD' && to === 'CNY') return 7.2;
    if (from === 'CNY' && to === 'USD') return 1 / 7.2;
    if (from === 'JPY' && to === 'USD') return JPY_TO_CNY_RATE / 7.2;
    return 1;
  }

  /**
   * List orders for a user with pagination and optional status filter
   */
  async findByUser(
    userId: string,
    query: OrderQueryDto,
  ): Promise<{ orders: Order[]; total: number }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const whereCondition: any = { userId };
    if (query.status) {
      const statuses = query.status.split(',') as OrderStatus[];
      whereCondition.status = In(statuses);
    }

    const [orders, total] = await this.ordersRepository.findAndCount({
      where: whereCondition,
      relations: ['items', 'address'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { orders, total };
  }

  /**
   * Get order by ID for a specific user
   */
  async findById(id: string, userId: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id, userId },
      relations: ['items', 'items.product', 'address'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  /**
   * Find order by ID and user ID (used by payments service)
   */
  async findOneByIdAndUser(id: string, userId: string): Promise<Order | null> {
    return this.ordersRepository.findOne({
      where: { id, userId },
      relations: ['items', 'address'],
    });
  }

  /**
   * Update order payment status
   */
  async updatePaymentStatus(
    orderId: string,
    status: 'pending' | 'paid' | 'processing' | 'cancelled' | 'refunded',
    paymentMethod?: string,
    paymentId?: string,
  ): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.status = status as OrderStatus;
    if (paymentMethod) {
      order.paymentMethod = paymentMethod;
    }
    if (paymentId) {
      order.paymentId = paymentId;
    }
    if (status === 'paid') {
      order.paidAt = new Date();
    }

    return this.ordersRepository.save(order);
  }

  /**
   * Create a new order from cart items
   */
  async create(userId: string, dto: CreateOrderDto): Promise<Order> {
    // Get cart to validate items and calculate totals
    const cart = await this.cartService.getCart(userId);

    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Filter items that match cart item IDs or are specified individually
    let orderItems: any[] = [];
    let subtotalJpy = 0;
    let subtotalCny = 0;
    let subtotalUsd = 0;

    if (dto.items && dto.items.length > 0) {
      // Order specific items from cart
      const cartItemIds = dto.items
        .filter((i) => i.cartItemId)
        .map((i) => i.cartItemId);

      orderItems = cart.items.filter((item) =>
        cartItemIds.includes(item.id),
      );
    } else {
      // Order all items in cart
      orderItems = cart.items;
    }

    if (orderItems.length === 0) {
      throw new BadRequestException('No valid items to order');
    }

    // Calculate subtotals
    for (const item of orderItems) {
      const unitJpy = Number(item.unitPriceJpy) || 0;
      const unitCny = Number(item.unitPriceCny) || unitJpy * JPY_TO_CNY_RATE;
      const unitUsd = unitCny / 7.2;
      const qty = item.quantity || 1;

      subtotalJpy += unitJpy * qty;
      subtotalCny += unitCny * qty;
      subtotalUsd += unitUsd * qty;
    }

    // Calculate fees
    const currency = dto.currency || 'CNY';
    const rate = this.getExchangeRate('JPY', currency);
    const subtotalInCurrency =
      currency === 'JPY'
        ? subtotalJpy
        : currency === 'USD'
          ? subtotalUsd
          : subtotalCny;

    // Estimated shipping (placeholder)
    const shippingFeeJpy = 2100; // 600 domestic + 1500 international
    const shippingFeeInCurrency =
      currency === 'JPY'
        ? shippingFeeJpy
        : currency === 'USD'
          ? shippingFeeJpy * rate / 7.2
          : shippingFeeJpy * rate;

    // Service fee (placeholder: 3%)
    const serviceFeeJpy = Math.round(subtotalJpy * 0.03);
    const serviceFeeInCurrency =
      currency === 'JPY'
        ? serviceFeeJpy
        : currency === 'USD'
          ? serviceFeeJpy * rate / 7.2
          : serviceFeeJpy * rate;

    // Coupon discount (placeholder)
    let couponDiscountCny = 0;
    // TODO: validate coupon code
    if (dto.couponCode === 'SAVE10') {
      couponDiscountCny = 10;
    }

    const totalAmount =
      subtotalInCurrency +
      shippingFeeInCurrency +
      serviceFeeInCurrency -
      (currency === 'CNY' ? couponDiscountCny : 0);

    const orderNo = await this.generateOrderNo();

    const order = this.ordersRepository.create({
      userId,
      orderNo,
      addressId: dto.addressId,
      status: OrderStatus.PENDING,
      subtotalJpy,
      subtotalCny,
      subtotalUsd,
      shippingFeeJpy,
      shippingFeeCny: shippingFeeJpy * JPY_TO_CNY_RATE,
      serviceFeeJpy,
      serviceFeeCny: serviceFeeJpy * JPY_TO_CNY_RATE,
      couponDiscountCny,
      totalAmount,
      totalCurrency: currency,
      buyerMessage: dto.buyerMessage,
      exchangeRateUsed: JPY_TO_CNY_RATE,
    });

    const savedOrder = await this.ordersRepository.save(order);

    // Create order items with snapshots
    const orderItemsToSave = orderItems.map((item) => {
      const product = item.product as any;
      const unitJpy = Number(item.unitPriceJpy) || 0;
      const unitCny = Number(item.unitPriceCny) || unitJpy * JPY_TO_CNY_RATE;
      const qty = item.quantity || 1;

      return this.orderItemsRepository.create({
        orderId: savedOrder.id,
        productId: item.product?.id || item.productId,
        platform: item.product?.platform || product?.platform || 'unknown',
        platformProductId: product?.platformProductId || '',
        titleZhSnapshot: product?.titleZh || product?.title || '',
        titleEnSnapshot: product?.titleEn || '',
        titleJaSnapshot: product?.titleJa || '',
        coverImageUrl:
          product?.images?.[0] ||
          product?.coverImage ||
          item.product?.coverImage ||
          '',
        unitPriceJpy: unitJpy,
        unitPriceCny: unitCny,
        quantity: qty,
        subtotalJpy: unitJpy * qty,
        subtotalCny: unitCny * qty,
        options: item.options || {},
        sellerId: item.seller?.id || product?.sellerId || '',
        sellerName: item.seller?.name || product?.sellerName || '',
        status: 'pending',
      });
    });

    await this.orderItemsRepository.save(orderItemsToSave);

    // Remove ordered items from cart
    const cartItemIds = orderItems.map((item) => item.id);
    for (const cartItemId of cartItemIds) {
      try {
        await this.cartService.removeItem(cartItemId, userId);
      } catch {
        // Ignore errors
      }
    }

    return this.findById(savedOrder.id, userId);
  }

  /**
   * Cancel an order
   */
  async cancel(id: string, userId: string): Promise<Order> {
    const order = await this.findById(id, userId);

    const nonCancellableStatuses = [
      OrderStatus.PROCESSING,
      OrderStatus.PURCHASED,
      OrderStatus.SHIPPED,
      OrderStatus.IN_TRANSIT,
      OrderStatus.DELIVERED,
    ];

    if (nonCancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        'Order cannot be cancelled at this stage',
      );
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    order.status = OrderStatus.CANCELLED;
    return this.ordersRepository.save(order);
  }

  /**
   * Track order logistics (placeholder)
   */
  async track(id: string, userId: string): Promise<any> {
    const order = await this.findById(id, userId);

    if (!order.trackingNumber) {
      return {
        orderId: order.id,
        orderNo: order.orderNo,
        status: order.status,
        trackingNumber: null,
        trackingInfo: null,
        message: 'Tracking number not available yet',
      };
    }

    // TODO: Integrate with shipping carrier API (EMS, DHL, FedEx)
    return {
      orderId: order.id,
      orderNo: order.orderNo,
      status: order.status,
      trackingNumber: order.trackingNumber,
      shippingCarrier: order.shippingCarrier,
      shippedAt: order.shippedAt,
      estimatedDelivery: order.estimatedDelivery,
      trackingInfo: null, // Placeholder for API response
    };
  }
}
