/**
 * 电商平台集成 API 控制器
 */

import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncService } from './sync.service';
import { RakutenService } from './rakuten.service';
import { AmazonService } from './amazon.service';
import { YahooService } from './yahoo.service';
import { MercariService } from './mercari.service';

@Controller('api/v1/integrations')
export class IntegrationsController {
  constructor(
    private syncService: SyncService,
    private rakutenService: RakutenService,
    private amazonService: AmazonService,
    private yahooService: YahooService,
    private mercariService: MercariService,
  ) {}

  @Get('status')
  async getStatus() {
    const statuses = await this.syncService.getSyncStatus();
    return { success: true, data: statuses };
  }

  @UseGuards(JwtAuthGuard)
  @Get('sync')
  async syncAll(@Query('keyword') keyword: string) {
    if (!keyword) return { success: false, error: 'keyword is required' };
    const results = await this.syncService.searchAllPlatforms(keyword);
    return { success: true, data: results };
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  async syncPlatforms(@Body() body: { platforms?: string[]; keyword: string }) {
    const { platforms, keyword } = body;
    if (!keyword) return { success: false, error: 'keyword is required' };
    const platformList = (platforms || ['rakuten', 'amazon', 'yahoo', 'mercari']) as any;
    const results = await this.syncService.syncByPlatform(platformList, keyword);
    return { success: true, data: results };
  }

  @UseGuards(JwtAuthGuard)
  @Get('refresh')
  async refreshPrices() {
    const count = await this.syncService.refreshPrices();
    return { success: true, data: { refreshed: count } };
  }

  @Get('rakuten/search')
  async searchRakuten(@Query('keyword') keyword: string, @Query('page') page?: number) {
    if (!keyword) return { success: false, error: 'keyword is required' };
    if (!this.rakutenService.isConfigured()) {
      return { success: false, error: 'Rakuten API not configured', notice: 'Set RAKUTEN_APP_ID and RAKUTEN_AFFILIATE_ID' };
    }
    const result = await this.rakutenService.search(keyword, page || 1);
    return { success: true, data: result };
  }

  @Get('amazon/search')
  async searchAmazon(@Query('keyword') keyword: string, @Query('page') page?: number) {
    if (!keyword) return { success: false, error: 'keyword is required' };
    if (!this.amazonService.isConfigured()) {
      return { success: false, error: 'Amazon API not configured', notice: this.amazonService.getMigrationNotice() };
    }
    const result = await this.amazonService.search(keyword, page || 1);
    return { success: true, data: result };
  }

  @Get('yahoo/search')
  async searchYahoo(@Query('keyword') keyword: string, @Query('page') page?: number) {
    if (!keyword) return { success: false, error: 'keyword is required' };
    if (!this.yahooService.isConfigured()) {
      return { success: false, error: 'Yahoo API not configured', notice: 'Set YAHOO_APP_ID' };
    }
    const result = await this.yahooService.search(keyword, page || 1);
    return { success: true, data: result };
  }

  @Get('mercari/search')
  async searchMercari(@Query('keyword') keyword: string, @Query('page') page?: number) {
    if (!keyword) return { success: false, error: 'keyword is required' };
    if (!this.mercariService.isConfigured()) {
      return { success: false, error: 'Mercari API not configured', notice: this.mercariService.getSetupGuide() };
    }
    const result = await this.mercariService.search(keyword, page || 1);
    return { success: true, data: result };
  }

  /**
   * 统一搜索 - 并行搜索 Rakuten + Yahoo，返回统一格式
   * 前端商品搜索专用端点
   */
  @Get('search/unified')
  async unifiedSearch(
    @Query('keyword') keyword: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('platforms') platforms?: string,
  ) {
    if (!keyword) return { success: false, error: 'keyword is required' };
    
    const platformList = platforms ? platforms.split(',') : ['rakuten', 'yahoo'];
    const results = await this.syncService.unifiedSearch(keyword, page, limit, platformList);
    return { success: true, data: results };
  }
}
