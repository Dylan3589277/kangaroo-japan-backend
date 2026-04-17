/**
 * 商品同步服务 - 协调多平台商品同步
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, Platform } from '../products/product.entity';
import { RakutenService } from './rakuten.service';
import { AmazonService } from './amazon.service';
import { YahooService } from './yahoo.service';
import { MercariService } from './mercari.service';
import { UnifiedSearchResultDto, UnifiedProduct } from './dto/unified-search.dto';

export interface SyncResult {
  platform: string;
  keyword: string;
  found: number;
  synced: number;
  success: boolean;
  error?: string;
}

export interface SyncStatus {
  platform: 'rakuten' | 'amazon' | 'yahoo' | 'mercari';
  configured: boolean;
  lastSync?: Date;
  totalProducts?: number;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private rakutenService: RakutenService,
    private amazonService: AmazonService,
    private yahooService: YahooService,
    private mercariService: MercariService,
  ) {}

  /**
   * 从所有已配置的平台搜索商品
   */
  async searchAllPlatforms(keyword: string): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    // 并行搜索所有平台
    const promises = [
      this.searchPlatform('rakuten', keyword, () => 
        this.rakutenService.searchAndSync(keyword, 30)
      ),
      this.searchPlatform('amazon', keyword, () => 
        this.amazonService.searchAndSync(keyword, 10)
      ),
      this.searchPlatform('yahoo', keyword, () => 
        this.yahooService.searchAndSync(keyword, 20)
      ),
      this.searchPlatform('mercari', keyword, () => 
        this.mercariService.searchAndSync(keyword, 20)
      ),
    ];

    const platformResults = await Promise.allSettled(promises);
    
    for (let i = 0; i < platformResults.length; i++) {
      const result = platformResults[i];
      const platform = ['rakuten', 'amazon', 'yahoo', 'mercari'][i];
      
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          platform,
          keyword,
          found: 0,
          synced: 0,
          success: false,
          error: result.reason?.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * 搜索单个平台
   */
  private async searchPlatform(
    platform: string,
    keyword: string,
    searchFn: () => Promise<number>
  ): Promise<SyncResult> {
    try {
      // 先搜索获取数量，再同步
      const synced = await searchFn();
      return {
        platform,
        keyword,
        found: synced,
        synced,
        success: true,
      };
    } catch (error) {
      this.logger.error(`Failed to search ${platform}: ${error.message}`);
      return {
        platform,
        keyword,
        found: 0,
        synced: 0,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取各平台同步状态
   */
  async getSyncStatus(): Promise<SyncStatus[]> {
    const statuses: SyncStatus[] = [];

    // 乐天
    const rakutenCount = await this.productRepository.count({
      where: { platform: Platform.RAKUTEN },
    });
    const rakutenLast = await this.productRepository.findOne({
      where: { platform: Platform.RAKUTEN },
      order: { lastSyncedAt: 'DESC' },
    });
    statuses.push({
      platform: 'rakuten',
      configured: this.rakutenService.isConfigured(),
      lastSync: rakutenLast?.lastSyncedAt,
      totalProducts: rakutenCount,
    });

    // Amazon
    const amazonCount = await this.productRepository.count({
      where: { platform: Platform.AMAZON },
    });
    const amazonLast = await this.productRepository.findOne({
      where: { platform: Platform.AMAZON },
      order: { lastSyncedAt: 'DESC' },
    });
    statuses.push({
      platform: 'amazon',
      configured: this.amazonService.isConfigured(),
      lastSync: amazonLast?.lastSyncedAt,
      totalProducts: amazonCount,
    });

    // Yahoo
    const yahooCount = await this.productRepository.count({
      where: { platform: Platform.YAHOO },
    });
    const yahooLast = await this.productRepository.findOne({
      where: { platform: Platform.YAHOO },
      order: { lastSyncedAt: 'DESC' },
    });
    statuses.push({
      platform: 'yahoo',
      configured: this.yahooService.isConfigured(),
      lastSync: yahooLast?.lastSyncedAt,
      totalProducts: yahooCount,
    });

    // Mercari
    const mercariCount = await this.productRepository.count({
      where: { platform: Platform.MERCARI },
    });
    const mercariLast = await this.productRepository.findOne({
      where: { platform: Platform.MERCARI },
      order: { lastSyncedAt: 'DESC' },
    });
    statuses.push({
      platform: 'mercari',
      configured: this.mercariService.isConfigured(),
      lastSync: mercariLast?.lastSyncedAt,
      totalProducts: mercariCount,
    });

    return statuses;
  }

  /**
   * 同步单个平台的商品
   */
  async syncPlatform(platform: 'rakuten' | 'amazon' | 'yahoo' | 'mercari', keyword: string): Promise<SyncResult> {
    switch (platform) {
      case 'rakuten':
        if (!this.rakutenService.isConfigured()) {
          return { platform, keyword, found: 0, synced: 0, success: false, error: 'API not configured' };
        }
        const rCount = await this.rakutenService.searchAndSync(keyword, 30);
        return { platform, keyword, found: rCount, synced: rCount, success: true };

      case 'amazon':
        if (!this.amazonService.isConfigured()) {
          return { platform, keyword, found: 0, synced: 0, success: false, error: 'API not configured' };
        }
        const aCount = await this.amazonService.searchAndSync(keyword, 10);
        return { platform, keyword, found: aCount, synced: aCount, success: true };

      case 'yahoo':
        if (!this.yahooService.isConfigured()) {
          return { platform, keyword, found: 0, synced: 0, success: false, error: 'API not configured' };
        }
        const yCount = await this.yahooService.searchAndSync(keyword, 20);
        return { platform, keyword, found: yCount, synced: yCount, success: true };

      case 'mercari':
        if (!this.mercariService.isConfigured()) {
          return { platform, keyword, found: 0, synced: 0, success: false, error: 'API not configured' };
        }
        const mCount = await this.mercariService.searchAndSync(keyword, 20);
        return { platform, keyword, found: mCount, synced: mCount, success: true };
    }
  }

  /**
   * 同步指定平台的商品
   */
  async syncByPlatform(platforms: ('rakuten' | 'amazon' | 'yahoo' | 'mercari')[], keyword: string): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    
    for (const platform of platforms) {
      const result = await this.syncPlatform(platform, keyword);
      results.push(result);
    }

    return results;
  }

  /**
   * 刷新商品价格 (从各平台)
   */
  async refreshPrices(): Promise<number> {
    // 获取所有有 lastSyncedAt 的商品
    const products = await this.productRepository.find({
      where: {},
      order: { lastSyncedAt: 'ASC' },
      take: 100, // 每次最多刷新100个
    });

    let refreshed = 0;
    for (const product of products) {
      try {
        switch (product.platform) {
          case Platform.RAKUTEN:
            if (this.rakutenService.isConfigured()) {
              const item = await this.rakutenService.getItem(product.platformProductId);
              if (item) {
                await this.rakutenService.syncItem(item);
                refreshed++;
              }
            }
            break;
          case Platform.AMAZON:
            if (this.amazonService.isConfigured()) {
              const item = await this.amazonService.getItem(product.platformProductId);
              if (item) {
                await this.amazonService.syncItem(item);
                refreshed++;
              }
            }
            break;
          case Platform.YAHOO:
            if (this.yahooService.isConfigured()) {
              const item = await this.yahooService.getItem(product.platformProductId);
              if (item) {
                await this.yahooService.syncItem(item);
                refreshed++;
              }
            }
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to refresh ${product.platform} item ${product.id}: ${error.message}`);
      }
    }

    return refreshed;
  }

  /**
   * 统一搜索 - 并行搜索多个平台，返回统一格式
   */
  async unifiedSearch(
    keyword: string,
    page: number = 1,
    limit: number = 20,
    platforms: string[] = ['rakuten', 'yahoo'],
  ): Promise<UnifiedSearchResultDto> {
    const results: UnifiedProduct[] = [];
    const platformStats: Record<string, { found: number; returned: number }> = {};

    // 并行搜索各平台
    const searchPromises: Promise<void>[] = [];

    if (platforms.includes('rakuten') && this.rakutenService.isConfigured()) {
      searchPromises.push(
        this.searchRakutenUnified(keyword, page, limit, results, platformStats)
      );
    }

    if (platforms.includes('yahoo') && this.yahooService.isConfigured()) {
      searchPromises.push(
        this.searchYahooUnified(keyword, page, limit, results, platformStats)
      );
    }

    await Promise.all(searchPromises);

    // 分页处理
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = results.slice(startIndex, endIndex);

    return {
      items: paginatedItems,
      pagination: {
        page,
        limit,
        total: results.length,
        totalPages: Math.ceil(results.length / limit),
        hasNext: endIndex < results.length,
        hasPrev: page > 1,
      },
      platforms: {
        rakuten: platformStats['rakuten'] || { found: 0, returned: 0 },
        yahoo: platformStats['yahoo'] || { found: 0, returned: 0 },
      },
    };
  }

  /**
   * 搜索乐天并转换为统一格式
   */
  private async searchRakutenUnified(
    keyword: string,
    page: number,
    limit: number,
    results: UnifiedProduct[],
    platformStats: Record<string, { found: number; returned: number }>,
  ): Promise<void> {
    try {
      const data = await this.rakutenService.search(keyword, page, limit);
      const items = data.Items || [];
      const count = data.count || 0;

      platformStats['rakuten'] = { found: count, returned: items.length };

      for (const item of items) {
        results.push({
          id: `rakuten_${item.itemCode}`,
          platform: 'rakuten',
          platformName: 'Rakuten',
          title: item.itemName,
          priceJpy: item.itemPrice,
          priceCny: Math.round(item.itemPrice * 0.048), // 简化汇率
          priceUsd: Math.round(item.itemPrice * 0.0067 * 100) / 100,
          currency: 'JPY',
          images: item.mediumImageUrls || item.smallImageUrls || [],
          imagesCount: item.imageFlag || 0,
          rating: item.reviewAverage ? Number(item.reviewAverage) : null,
          reviewCount: item.reviewCount || 0,
          salesCount: 0,
          inStock: item.availability === 1,
          status: item.availability === 1 ? 'on_sale' : 'sold_out',
          url: item.itemUrl,
          brand: item.shopName || undefined,
        });
      }
    } catch (error) {
      this.logger.error(`Rakuten unified search failed: ${error.message}`);
      platformStats['rakuten'] = { found: 0, returned: 0 };
    }
  }

  /**
   * 搜索 Yahoo 并转换为统一格式
   */
  private async searchYahooUnified(
    keyword: string,
    page: number,
    limit: number,
    results: UnifiedProduct[],
    platformStats: Record<string, { found: number; returned: number }>,
  ): Promise<void> {
    try {
      const data = await this.yahooService.search(keyword, page, limit);
      const hits = data.hits || [];
      const total = data.totalResultsAvailable || 0;

      platformStats['yahoo'] = { found: total, returned: hits.length };

      for (const hit of hits) {
        results.push({
          id: `yahoo_${hit.index}`,
          platform: 'yahoo',
          platformName: 'Yahoo',
          title: hit.name,
          priceJpy: hit.price,
          priceCny: Math.round(hit.price * 0.048),
          priceUsd: Math.round(hit.price * 0.0067 * 100) / 100,
          currency: 'JPY',
          images: hit.image?.medium ? [hit.image.medium] : (typeof hit.image === 'string' ? [hit.image] : []),
          imagesCount: hit.image ? 1 : 0,
          rating: null,
          reviewCount: 0,
          salesCount: 0,
          inStock: hit.inStock === true,
          status: hit.inStock === true ? 'on_sale' : 'sold_out',
          url: hit.url,
        });
      }
    } catch (error) {
      this.logger.error(`Yahoo unified search failed: ${error.message}`);
      platformStats['yahoo'] = { found: 0, returned: 0 };
    }
  }
}
