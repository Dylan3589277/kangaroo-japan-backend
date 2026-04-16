import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Order, OrderStatus } from "./order.entity";
import { OrderItem } from "./order-item.entity";

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
  ) {}

  async findByUser(userId: string) {
    return this.ordersRepository.find({
      where: { userId },
      relations: ["items", "items.product", "address"],
      order: { createdAt: "DESC" },
    });
  }

  async findById(id: string, userId: string) {
    const order = await this.ordersRepository.findOne({
      where: { id, userId },
      relations: ["items", "items.product", "address"],
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async create(
    userId: string,
    data: {
      addressId: string;
      paymentMethod: string;
      items: { productId: string; quantity: number; price: number; platform: string }[];
      currency?: string;
      shippingFee?: number;
    },
  ) {
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const orderNo = `K${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const order = this.ordersRepository.create({
      userId,
      orderNo,
      addressId: data.addressId,
      paymentMethod: data.paymentMethod,
      totalAmount: totalAmount + (data.shippingFee || 0),
      shippingFee: data.shippingFee || 0,
      currency: data.currency || "JPY",
    });
    const savedOrder = await this.ordersRepository.save(order);

    const orderItems = data.items.map((item) =>
      this.orderItemsRepository.create({
        orderId: savedOrder.id,
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: item.price,
        platform: item.platform,
      }),
    );
    await this.orderItemsRepository.save(orderItems);

    return this.findById(savedOrder.id, userId);
  }

  async cancel(id: string, userId: string) {
    const order = await this.findById(id, userId);
    if (order.status !== OrderStatus.PENDING) {
      throw new Error("Only pending orders can be cancelled");
    }
    order.status = OrderStatus.CANCELLED;
    return this.ordersRepository.save(order);
  }
}
