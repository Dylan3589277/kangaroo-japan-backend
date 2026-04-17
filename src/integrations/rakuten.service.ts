/**
 * 乐天市场 (Rakuten Ichiba) API 集成服务
 * 
 * API 文档: https://webservice.rakuten.co.jp/documentation/ichiba-item-search
 * 
 * ⚠️ 重要: 2026-04 API 升级后必须添加 Origin 和 Referer header
 * Origin 必须设置为应用注册的白名单域名 (jp-buy.com，不是 www.jp-buy.com)
 * 否则会返回错误: REQUEST_CONTEXT_BODY_HTTP_REFERRER_MISSING / HTTP_REFERRER_NOT_ALLOWED
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, Platform, ProductStatus } from '../products/product.entity';
import { Category } from '../products/category.entity';

@Injectable()
export class RakutenService {
  private readonly logger = new Logger(RakutenService.name);
  
  // 新版 API 端点 (2026-04 版本)
  private readonly BASE_URL = 'https://openapi.rakuten.co.jp/ichibams/api';
  private readonly APPLICATION_ID = process.env.RAKUTEN_APP_ID || '';
  private readonly ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY || '';
  private readonly AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID || '';

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async search(keyword: string, page = 1, limit = 30): Promise<any> {
    if (!this.APPLICATION_ID || !this.ACCESS_KEY) {
      this.logger.warn('Rakuten API keys not configured');
      return { items: [] };
    }

    const url = `${this.BASE_URL}/IchibaItem/Search/20260401`;
    const params = new URLSearchParams({
      applicationId: this.APPLICATION_ID,
      accessKey: this.ACCESS_KEY,
      keyword,
      page: page.toString(),
      hits: Math.min(limit, 30).toString(),
      format: 'json',
      formatVersion: '2',
      ...(this.AFFILIATE_ID && { affiliateId: this.AFFILIATE_ID }),
    });

    try {
      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Origin': 'https://jp-buy.com',
          'Referer': 'https://jp-buy.com/',
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Rakuten API error: ${response.status} - ${errorText}`);
        return { items: [] };
      }
      const data = await response.json();
      return data;
    } catch (error) {
      this.logger.error(`Failed to search Rakuten: ${error.message}`);
      return { items: [] };
    }
  }

  async getItem(itemCode: string): Promise<any> {
    if (!this.APPLICATION_ID || !this.ACCESS_KEY) return null;

    const url = `${this.BASE_URL}/IchibaItem/Search/20260401`;
    const params = new URLSearchParams({
      applicationId: this.APPLICATION_ID,
      accessKey: this.ACCESS_KEY,
      itemCode,
      format: 'json',
      formatVersion: '2',
    });

    try {
      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Origin': 'https://jp-buy.com',
          'Referer': 'https://jp-buy.com/',
        },
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.items?.[0] || null;
    } catch (error) {
      this.logger.error(`Failed to get Rakuten item: ${error.message}`);
      return null;
    }
  }

  async syncItem(item: any): Promise<Product> {
    // itemCode 格式: "shopId:itemId"
    const platformProductId = item.itemCode || item.itemUrl || '';

    let category: any = null;
    if (item.genreId) {
      category = await this.categoryRepository.findOne({ where: { id: String(item.genreId) } });
    }

    let product = await this.productRepository.findOne({
      where: { platform: Platform.RAKUTEN, platformProductId },
    });

    const images = item.mediumImageUrls?.map((img: any) => img.imageUrl) || 
                   item.smallImageUrls?.map((img: any) => img.imageUrl) || [];

    const productData: any = {
      platform: Platform.RAKUTEN,
      platformProductId,
      platformUrl: item.itemUrl,
      titleJa: item.itemName,
      titleZh: item.itemName,
      titleEn: item.itemName,
      descriptionJa: item.itemCaption || '',
      priceJpy: item.itemPrice,
      currency: 'JPY',
      images,
      imagesCount: images.length,
      status: item.availability === 1 ? ProductStatus.ACTIVE : ProductStatus.SOLD_OUT,
      rating: item.reviewAverage ? Number(item.reviewAverage) : undefined,
      reviewCount: item.reviewCount || 0,
      sellerName: item.shopName,
      categoryId: category?.id,
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
    const items = result.items || [];

    let synced = 0;
    for (const item of items) {
      try {
        await this.syncItem(item);
        synced++;
      } catch (error) {
        this.logger.error(`Failed to sync item ${item?.itemCode}: ${error.message}`);
      }
    }
    return synced;
  }

  isConfigured(): boolean {
    return !!(this.APPLICATION_ID && this.ACCESS_KEY);
  }
}
