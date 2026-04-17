/**
 * Amazon Japan (PA-API 5.0) 集成服务
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, Platform, ProductStatus } from '../products/product.entity';
import * as crypto from 'crypto';

@Injectable()
export class AmazonService {
  private readonly logger = new Logger(AmazonService.name);
  private readonly ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || '';
  private readonly SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
  private readonly PARTNER_TAG = process.env.AMAZON_PARTNER_TAG || '';
  private readonly HOST = 'webservices.amazon.co.jp';
  private readonly PATH = '/paapi5/searchitems';

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  private async sign(method: string, url: string, body: string): Promise<string> {
    const date = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const amzDate = date.replace(/[^T]/g, '').replace('T', '');
    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
    
    const headers: any = {
      'content-type': 'application/json',
      'host': this.HOST,
      'x-amz-date': amzDate,
    };
    
    const sortedHeaders = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaders.map(k => `${k}:${headers[k]}`).join('\n') + '\n';
    const signedHeaders = sortedHeaders.join(';');
    
    const canonicalRequest = [method, this.PATH, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const credentialScope = `${date.split('T')[0]}/${this.HOST}/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
    
    const kDate = crypto.createHmac('sha256', `AWS4${this.SECRET_KEY}`).update(date.split('T')[0]).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.HOST.split('.')[0]).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(this.HOST.split('.')[1] || 'webservices').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    
    return `AWS4-HMAC-SHA256 Credential=${this.ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')}`;
  }

  async search(keyword: string, page = 1, limit = 10): Promise<any[]> {
    if (!this.ACCESS_KEY || !this.SECRET_KEY || !this.PARTNER_TAG) {
      this.logger.warn('Amazon AWS credentials not configured');
      return [];
    }

    const body = JSON.stringify({
      keywords: keyword,
      searchIndex: 'All',
      resources: ['ITEMINFO_DISPLAY', 'IMAGES_PRIMARY', 'OFFERS_LISTINGS', 'CUSTOMERREVIEWS'],
      itemPage: page,
      itemCount: limit,
      partnerTag: this.PARTNER_TAG,
    });

    const amzDate = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    try {
      const authorization = await this.sign('POST', `https://${this.HOST}${this.PATH}`, body);
      
      const response = await fetch(`https://${this.HOST}${this.PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Amz-Date': amzDate,
          'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
          'Authorization': authorization,
        },
        body,
      });

      if (!response.ok) {
        this.logger.error(`Amazon API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return data.ItemsResult?.Items || [];
    } catch (error) {
      this.logger.error(`Failed to search Amazon: ${error.message}`);
      return [];
    }
  }

  async getItem(asin: string): Promise<any> {
    if (!this.ACCESS_KEY || !this.SECRET_KEY || !this.PARTNER_TAG) return null;

    const body = JSON.stringify({
      ASINs: [asin],
      resources: ['ITEMINFO_DISPLAY', 'IMAGES_PRIMARY', 'OFFERS_LISTINGS', 'CUSTOMERREVIEWS'],
      partnerTag: this.PARTNER_TAG,
    });

    const amzDate = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    try {
      const authorization = await this.sign('POST', `https://${this.HOST}${this.PATH}`, body);
      const response = await fetch(`https://${this.HOST}${this.PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Amz-Date': amzDate,
          'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
          'Authorization': authorization,
        },
        body,
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.ItemsResult?.Items?.[0] || null;
    } catch (error) {
      this.logger.error(`Failed to get Amazon item: ${error.message}`);
      return null;
    }
  }

  async syncItem(item: any): Promise<Product> {
    const listing = item.Offers?.Listings?.[0];
    const availability = listing?.Availability?.includes('Available') ?? false;

    let product = await this.productRepository.findOne({
      where: { platform: Platform.AMAZON, platformProductId: item.ASIN },
    });

    const productData: any = {
      platform: Platform.AMAZON,
      platformProductId: item.ASIN,
      platformUrl: item.DetailPageURL,
      titleEn: item.ItemInfo?.DisplayName,
      titleZh: item.ItemInfo?.DisplayName,
      titleJa: item.ItemInfo?.DisplayName,
      descriptionEn: item.ItemInfo?.Features?.map((f: any) => f.DisplayValue).join('\n') || '',
      priceJpy: listing?.Price?.Currency === 'JPY' ? listing.Price.Amount : undefined,
      priceUsd: listing?.Price?.Currency === 'USD' ? listing.Price.Amount : undefined,
      currency: listing?.Price?.Currency || 'JPY',
      images: item.Images?.Primary?.Medium ? [item.Images.Primary.Medium.Source] : [],
      imagesCount: item.Images?.Variants?.length || 0,
      status: availability ? ProductStatus.ACTIVE : ProductStatus.SOLD_OUT,
      rating: item.CustomerReview?.ReviewRating?.Source?.Value ? Number(item.CustomerReview.ReviewRating.Source.Value) : undefined,
      reviewCount: parseInt(item.CustomerReview?.TotalReviews?.Source?.Link?.match(/(\d+)$/)?.[1] || '0'),
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

  async searchAndSync(keyword: string, limit = 10): Promise<number> {
    const items = await this.search(keyword, 1, limit);
    let synced = 0;
    for (const item of items) {
      try {
        await this.syncItem(item);
        synced++;
      } catch (error) {
        this.logger.error(`Failed to sync item ${item?.ASIN}: ${error.message}`);
      }
    }
    return synced;
  }

  isConfigured(): boolean {
    return !!(this.ACCESS_KEY && this.SECRET_KEY && this.PARTNER_TAG);
  }

  getMigrationNotice(): string {
    return 'PA-API 将于 2026年4月30日停用。请迁移到 Creators API: https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction';
  }
}
