import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cart } from './cart.entity';
import { CartItem, CartItemStatus } from './cart-item.entity';
import { Product } from '../products/product.entity';

@Injectable()
export class CartService {
  private readonly jpyToCny: number;

  constructor(
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private cartItemRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private configService: ConfigService,
  ) {
    this.jpyToCny = this.configService.get<number>('exchange.jpyToCny', 0.05);
  }

  /**
   * Get or create a cart for the user
   */
  async getOrCreateCart(userId: string): Promise<Cart> {
    let cart = await this.cartRepository.findOne({ where: { userId } });
    if (!cart) {
      cart = this.cartRepository.create({ userId });
      cart = await this.cartRepository.save(cart);
    }
    return cart;
  }

  /**
   * Get full cart with items, products, grouped by seller
   */
  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    const items = await this.cartItemRepository.find({
      where: { cartId: cart.id, status: CartItemStatus.ACTIVE },
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });

    // Calculate totals
    let subtotalJpy = 0;
    let subtotalCny = 0;
    let subtotalUsd = 0;
    let totalItems = 0;

    const enrichedItems = items.map((item) => {
      const unitJpy = Number(item.priceAtAddJpy);
      const unitCny = Number(item.priceAtAddCny || 0);
      const unitUsd = Number(item.priceAtAddUsd || 0);
      const qty = item.quantity;

      subtotalJpy += unitJpy * qty;
      subtotalCny += unitCny * qty;
      subtotalUsd += unitUsd * qty;
      totalItems += qty;

      return {
        id: item.id,
        product: {
          id: item.product?.id,
          title:
            item.product?.titleZh ||
            item.product?.titleEn ||
            item.product?.titleJa ||
            '',
          coverImage: item.product?.images?.[0] || null,
          platform: item.product?.platform,
          priceJpy: unitJpy,
          priceCny: unitCny,
        },
        quantity: item.quantity,
        unitPriceJpy: unitJpy,
        unitPriceCny: unitCny,
        subtotalJpy: unitJpy * qty,
        subtotalCny: unitCny * qty,
        options: item.options || {},
        buyerMessage: item.buyerMessage,
        seller: {
          id: item.sellerId,
          name: item.sellerName,
        },
        createdAt: item.createdAt,
      };
    });

    // Group by seller
    const groupedBySeller: Record<string, any> = {};
    for (const item of enrichedItems) {
      const sellerKey = item.seller?.id || 'unknown';
      if (!groupedBySeller[sellerKey]) {
        groupedBySeller[sellerKey] = {
          seller: item.seller,
          items: [],
          subtotal: 0,
        };
      }
      groupedBySeller[sellerKey].items.push(item);
      groupedBySeller[sellerKey].subtotal += item.subtotalJpy;
    }

    // Update cart totals
    cart.totalItems = totalItems;
    cart.subtotalJpy = subtotalJpy;
    cart.subtotalCny = subtotalCny;
    cart.subtotalUsd = subtotalUsd;
    await this.cartRepository.save(cart);

    return {
      id: cart.id,
      items: enrichedItems,
      summary: {
        totalItems,
        subtotalJpy,
        subtotalCny,
        subtotalUsd,
        estimatedShippingJpy: 0,
        estimatedShippingCny: 0,
        totalJpy: subtotalJpy,
        totalCny: subtotalCny,
        currency: cart.preferredCurrency,
      },
      groupedBySeller: Object.values(groupedBySeller),
    };
  }

  /**
   * Add item to cart
   */
  async addItem(
    userId: string,
    productId: string,
    quantity = 1,
    options?: Record<string, any>,
    buyerMessage?: string,
  ) {
    // Validate quantity
    if (quantity < 1 || quantity > 5) {
      throw new BadRequestException('Quantity must be between 1 and 5');
    }

    // Get product
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const cart = await this.getOrCreateCart(userId);

    // Check if item already exists (active)
    let item = await this.cartItemRepository.findOne({
      where: { cartId: cart.id, productId, status: CartItemStatus.ACTIVE },
    });

    if (item) {
      // Update quantity
      const newQty = item.quantity + quantity;
      if (newQty > 5) {
        throw new BadRequestException('Maximum 5 items per product in cart');
      }
      item.quantity = newQty;
      item.options = options || item.options;
      item.buyerMessage = buyerMessage || item.buyerMessage;
      await this.cartItemRepository.save(item);
    } else {
      // Create new item
      item = this.cartItemRepository.create({
        cartId: cart.id,
        productId,
        quantity,
        priceAtAddJpy: Number(product.priceJpy),
        priceAtAddCny: Number(product.priceCny || 0),
        priceAtAddUsd: Number(product.priceUsd || 0),
        options: options || {},
        buyerMessage,
        sellerId: product.sellerId,
        sellerName: product.sellerName,
        status: CartItemStatus.ACTIVE,
      });
      await this.cartItemRepository.save(item);
    }

    return this.getCart(userId);
  }

  /**
   * Update cart item (quantity, options, message)
   */
  async updateItem(
    itemId: string,
    userId: string,
    data: {
      quantity?: number;
      options?: Record<string, any>;
      buyerMessage?: string;
    },
  ) {
    const cart = await this.getOrCreateCart(userId);

    const item = await this.cartItemRepository.findOne({
      where: { id: itemId, cartId: cart.id, status: CartItemStatus.ACTIVE },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (data.quantity !== undefined) {
      if (data.quantity < 1 || data.quantity > 5) {
        throw new BadRequestException('Quantity must be between 1 and 5');
      }
      item.quantity = data.quantity;
    }

    if (data.options !== undefined) {
      item.options = data.options;
    }

    if (data.buyerMessage !== undefined) {
      item.buyerMessage = data.buyerMessage;
    }

    await this.cartItemRepository.save(item);
    return this.getCart(userId);
  }

  /**
   * Remove item from cart
   */
  async removeItem(itemId: string, userId: string) {
    const cart = await this.getOrCreateCart(userId);

    const item = await this.cartItemRepository.findOne({
      where: { id: itemId, cartId: cart.id },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    // Soft delete
    item.status = CartItemStatus.REMOVED;
    await this.cartItemRepository.save(item);

    return this.getCart(userId);
  }

  /**
   * Clear all items in cart
   */
  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.cartItemRepository.update(
      { cartId: cart.id, status: CartItemStatus.ACTIVE },
      { status: CartItemStatus.REMOVED },
    );
    return { success: true };
  }

  /**
   * Calculate shipping and totals (placeholder for actual shipping calculation)
   */
  async calculate(userId: string, _addressId?: string) {
    const cartData = await this.getCart(userId);

    // TODO: Integrate with shipping API based on address
    // For now, estimate shipping per seller group
    let estimatedShippingJpy = 0;
    let estimatedShippingCny = 0;

    const sellerGroups = cartData.groupedBySeller;
    for (const group of sellerGroups) {
      // Base shipping per seller: ~600 JPY domestic + 1500 JPY international
      const baseShippingJpy = group.items.length > 0 ? 600 + 1500 : 0;
      estimatedShippingJpy += baseShippingJpy;
    }

    // Use configured exchange rate
    const estimatedShippingCnyRate = this.jpyToCny;
    estimatedShippingCny = estimatedShippingJpy * estimatedShippingCnyRate;

    const totalJpy =
      Number(cartData.summary.subtotalJpy) + estimatedShippingJpy;
    const totalCny =
      Number(cartData.summary.subtotalCny) + estimatedShippingCny;

    return {
      ...cartData,
      summary: {
        ...cartData.summary,
        estimatedShippingJpy,
        estimatedShippingCny,
        totalJpy,
        totalCny,
      },
      shippingEstimate: {
        shippingJpy: estimatedShippingJpy,
        shippingCny: estimatedShippingCny,
        currency: 'CNY',
        note: 'Shipping cost is estimated. Final cost will be calculated at checkout.',
      },
    };
  }
}
