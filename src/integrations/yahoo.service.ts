/**
 * Yahoo!购物 (Yahoo! Japan Shopping) API 集成服务
 * 
 * API 文档: https://developer.yahoo.co.jp/webapi/shopping/v3/itemsearch.html
 * 
 * 重要: 商品搜索 API 只需要 appid 参数，不需要 OAuth!
 * appid = Client ID (アプリケーションID)
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, Platform, ProductStatus } from '../products/product.entity';

@Injectable()
export class YahooService {
  private readonly logger = new Logger(YahooService.name);
  
  // Yahoo Shopping API v3 endpoint
  private readonly BASE_URL = 'https://shopping.yahooapis.jp/ShoppingWebService/V3';
  
  // OAuth credentials (用于需要认证的 API)
  private readonly CLIENT_ID = process.env.YAHOO_CLIENT_ID || '';
  private readonly CLIENT_SECRET = process.env.YAHOO_CLIENT_SECRET || '';

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  /**
   * 搜索商品 - 只需要 appid 参数
   */
  async search(keyword: string, page = 1, limit = 30): Promise<any> {
    if (!this.CLIENT_ID) {
      this.logger.warn('Yahoo API appid not configured');
      return { hits: [], totalResultsAvailable: 0 };
    }

    const params = new URLSearchParams({
      appid: this.CLIENT_ID,
      query: keyword,
      results: Math.min(limit, 50).toString(),
      start: ((page - 1) * limit + 1).toString(),
    });

    try {
      const response = await fetch(`${this.BASE_URL}/itemSearch?${params}`);
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Yahoo API error: ${response.status} - ${errorText}`);
        return { hits: [], totalResultsAvailable: 0 };
      }
      return await response.json();
    } catch (error) {
      this.logger.error(`Failed to search Yahoo: ${error.message}`);
      return { hits: [], totalResultsAvailable: 0 };
    }
  }

  async getItem(code: string): Promise<any> {
    if (!this.CLIENT_ID) return null;

    try {
      const response = await fetch(
        `${this.BASE_URL}/itemSearch?appid=${this.CLIENT_ID}&query=${code}`,
      );
      if (!response.ok) return null;
      const data = await response.json();
      return data.hits?.[0] || null;
    } catch (error) {
      this.logger.error(`Failed to get Yahoo item: ${error.message}`);
      return null;
    }
  }

  async syncItem(item: any): Promise<Product> {
    const platformProductId = item.code || item.url || '';

    let product = await this.productRepository.findOne({
      where: { platform: Platform.YAHOO, platformProductId },
    });

    const price = parseFloat(item.price || '0');
    const images = item.image?.medium ? [item.image.medium] : 
                   item.image?.small ? [item.image.small] : [];

    const productData: any = {
      platform: Platform.YAHOO,
      platformProductId,
      platformUrl: item.url,
      titleJa: item.name,
      titleZh: item.name,
      titleEn: item.name,
      descriptionJa: item.description || '',
      priceJpy: price,
      currency: 'JPY',
      images,
      imagesCount: item.imageId ? 1 : 0,
      status: item.inStock ? ProductStatus.ACTIVE : ProductStatus.SOLD_OUT,
      rating: item.review?.rate ? Number(item.review.rate) : undefined,
      reviewCount: item.review?.count || 0,
      sellerName: item.seller?.name,
      salesCount: 0,
      lastSyncedAt: new Date(),
      rawData: item,
    };

    if (product) {
      await this.productRepository.update(product.id, productData);
      const updated = await this.productRepository.findOne({ where: { id: product.id } });
      return updated!;
    } else {
      const newProduct = this.productRepository.create(productData) as unknown as Product;
      await this.productRepository.save(newProduct);
      return newProduct;
    }
  }

  async searchAndSync(keyword: string, limit = 30): Promise<number> {
    const result = await this.search(keyword, 1, limit);
    const items = result.hits || [];

    let synced = 0;
    for (const item of items) {
      try {
        await this.syncItem(item);
        synced++;
      } catch (error) {
        this.logger.error(`Failed to sync item ${item?.code}: ${error.message}`);
      }
    }
    return synced;
  }

  isConfigured(): boolean {
    return !!this.CLIENT_ID;
  }
}
