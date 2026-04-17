/**
 * Mercari (メルカリ) API 集成服务
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, Platform, ProductStatus } from '../products/product.entity';

@Injectable()
export class MercariService {
  private readonly logger = new Logger(MercariService.name);
  private readonly SHOPS_API_URL = 'https://api.mercari-shops.com/v1/graphql';
  private readonly SHOPS_API_TOKEN = process.env.MERCARI_SHOPS_TOKEN || '';

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async search(query: string, page = 1, limit = 20): Promise<any> {
    if (!this.SHOPS_API_TOKEN) {
      this.logger.warn('Mercari Shops API token not configured');
      return { items: [], total: 0 };
    }

    const graphqlQuery = `
      query SearchItems($query: String!, $page: Int!, $limit: Int!) {
        searchItems(query: $query, page: $page, limit: $limit) {
          items {
            id, status, name, description, price
            images { photos { thumbnail, original } }
            categoryId, brand, size, condition
            shippingPayer { name }
            seller { id, nickname }
            createdAt
          }
          total, page, perPage
        }
      }
    `;

    try {
      const response = await fetch(this.SHOPS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.SHOPS_API_TOKEN}`,
        },
        body: JSON.stringify({ query: graphqlQuery, variables: { query, page, limit } }),
      });

      if (!response.ok) throw new Error(`Mercari API error: ${response.status}`);
      const data = await response.json();
      return {
        items: data.data?.searchItems?.items || [],
        total: data.data?.searchItems?.total || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to search Mercari: ${error.message}`);
      return { items: [], total: 0 };
    }
  }

  async getItem(itemId: string): Promise<any> {
    if (!this.SHOPS_API_TOKEN) return null;

    const graphqlQuery = `
      query GetItem($id: ID!) {
        item(id: $id) {
          id, status, name, description, price
          images { photos { thumbnail, original } }
          categoryId, brand, size, condition
          shippingPayer { name }
          seller { id, nickname }
          createdAt
        }
      }
    `;

    try {
      const response = await fetch(this.SHOPS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.SHOPS_API_TOKEN}`,
        },
        body: JSON.stringify({ query: graphqlQuery, variables: { id: itemId } }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.data?.item || null;
    } catch (error) {
      this.logger.error(`Failed to get Mercari item: ${error.message}`);
      return null;
    }
  }

  async syncItem(item: any): Promise<Product> {
    const statusMap: Record<string, ProductStatus> = {
      'on_sale': ProductStatus.ACTIVE,
      'trading': ProductStatus.TRADING,
      'sold_out': ProductStatus.SOLD_OUT,
    };

    let product = await this.productRepository.findOne({
      where: { platform: Platform.MERCARI, platformProductId: item.id || '' },
    });

    const images = item.images?.photos?.map((p: any) => p.original) || [];
    const conditionMap: Record<string, string> = {
      'new': '全新', 'like_new': '几乎全新', 'good': '良好',
      'acceptable': '可接受', 'bad': '较差',
    };

    const productData: any = {
      platform: Platform.MERCARI,
      platformProductId: item.id || '',
      platformUrl: `https://jp.mercari.com/item/${item.id}`,
      titleJa: item.name,
      titleZh: item.name,
      titleEn: item.name,
      descriptionJa: `${item.description || ''}\n\n状态: ${conditionMap[item.condition || ''] || item.condition || '未说明'}`,
      priceJpy: item.price || 0,
      currency: 'JPY',
      images,
      imagesCount: images.length,
      status: statusMap[item.status || ''] || ProductStatus.ACTIVE,
      sellerName: item.seller?.nickname,
      sellerId: item.seller?.id,
      specifications: {
        condition: item.condition,
        condition_zh: conditionMap[item.condition || ''],
        size: item.size,
        brand: item.brand,
        shipping: item.shipping_payer?.name,
      },
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

  async searchAndSync(query: string, limit = 20): Promise<number> {
    const result = await this.search(query, 1, limit);
    const items = result.items || [];

    let synced = 0;
    for (const item of items) {
      try {
        await this.syncItem(item);
        synced++;
      } catch (error) {
        this.logger.error(`Failed to sync item ${item?.id}: ${error.message}`);
      }
    }
    return synced;
  }

  isConfigured(): boolean {
    return !!this.SHOPS_API_TOKEN;
  }

  getSetupGuide(): string {
    return `
Mercari API 配置方案:
1. mercari-shops GraphQL API (需申请): https://api.mercari-shops.com/
2. mercapi (Python): https://github.com/take-kun/mercapi
3. Apify Scraper (付费): https://apify.com/cloud9_ai/mercari-scraper
`;
  }
}
