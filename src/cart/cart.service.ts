import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CartItem } from "./cart.entity";

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private cartRepository: Repository<CartItem>,
  ) {}

  async getCart(userId: string) {
    return this.cartRepository.find({
      where: { userId },
      relations: ["product"],
      order: { createdAt: "DESC" },
    });
  }

  async addItem(userId: string, productId: string, quantity = 1) {
    const existing = await this.cartRepository.findOne({
      where: { userId, productId },
    });
    if (existing) {
      existing.quantity += quantity;
      return this.cartRepository.save(existing);
    }
    const item = this.cartRepository.create({ userId, productId, quantity });
    return this.cartRepository.save(item);
  }

  async updateItem(id: string, userId: string, quantity: number) {
    const item = await this.cartRepository.findOne({ where: { id, userId } });
    if (!item) throw new NotFoundException("Cart item not found");
    item.quantity = quantity;
    return this.cartRepository.save(item);
  }

  async removeItem(id: string, userId: string) {
    const item = await this.cartRepository.findOne({ where: { id, userId } });
    if (!item) throw new NotFoundException("Cart item not found");
    await this.cartRepository.remove(item);
    return { success: true };
  }

  async clearCart(userId: string) {
    await this.cartRepository.delete({ userId });
    return { success: true };
  }
}
