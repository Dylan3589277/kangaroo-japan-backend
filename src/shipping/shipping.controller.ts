/**
 * 运费估算 API 控制器
 */

import { Controller, Get, Query } from '@nestjs/common';
import { ShippingService } from './shipping.service';

@Controller('api/v1/shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  /**
   * GET /api/v1/shipping/estimate
   * 获取运费估算
   * 
   * Query params:
   * - weight: number (kg, 必填)
   * - country: string (可选，默认 CN)
   * 
   * Example: GET /api/v1/shipping/estimate?weight=2.5&country=CN
   */
  @Get('estimate')
  async getEstimate(
    @Query('weight') weight: string,
    @Query('country') country?: string,
  ) {
    const weightKg = parseFloat(weight);
    
    if (isNaN(weightKg) || weightKg <= 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_WEIGHT',
          message: '重量必须为大于0的数字',
        },
      };
    }
    
    if (weightKg > 30) {
      return {
        success: false,
        error: {
          code: 'WEIGHT_TOO_LARGE',
          message: '最大支持30kg，请拆分为多个订单',
        },
      };
    }
    
    const options = await this.shippingService.getShippingOptions({
      weightKg,
      country: country || 'CN',
    });
    
    // 转换多币种价格
    const optionsWithPrices = await Promise.all(
      options.map(async (opt) => ({
        ...opt,
        priceCny: await this.shippingService.convertToCny(opt.priceJpy),
        priceUsd: await this.shippingService.convertToUsd(opt.priceJpy),
        estimatedDaysText: `${opt.estimatedDays.min}-${opt.estimatedDays.max}天`,
      }))
    );
    
    return {
      success: true,
      data: {
        weightKg,
        destination: country || '中国',
        options: optionsWithPrices,
      },
    };
  }
  
  /**
   * GET /api/v1/shipping/compare
   * 获取运费对比（最便宜 vs 最快）
   */
  @Get('compare')
  async getCompare(
    @Query('weight') weight: string,
    @Query('country') country?: string,
  ) {
    const weightKg = parseFloat(weight);
    
    if (isNaN(weightKg) || weightKg <= 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_WEIGHT',
          message: '重量必须为大于0的数字',
        },
      };
    }
    
    const cheapest = await this.shippingService.getCheapestOption({
      weightKg,
      country: country || 'CN',
    });
    
    const fastest = await this.shippingService.getFastestOption({
      weightKg,
      country: country || 'CN',
    });
    
    return {
      success: true,
      data: {
        weightKg,
        destination: country || '中国',
        cheapest: cheapest ? {
          ...cheapest,
          priceCny: await this.shippingService.convertToCny(cheapest.priceJpy),
          priceUsd: await this.shippingService.convertToUsd(cheapest.priceJpy),
          estimatedDaysText: `${cheapest.estimatedDays.min}-${cheapest.estimatedDays.max}天`,
        } : null,
        fastest: fastest ? {
          ...fastest,
          priceCny: await this.shippingService.convertToCny(fastest.priceJpy),
          priceUsd: await this.shippingService.convertToUsd(fastest.priceJpy),
          estimatedDaysText: `${fastest.estimatedDays.min}-${fastest.estimatedDays.max}天`,
        } : null,
      },
    };
  }
  
  /**
   * GET /api/v1/shipping/countries
   * 获取支持的国家列表
   */
  @Get('countries')
  async getCountries() {
    const countries = await this.shippingService.getSupportedCountries();
    return {
      success: true,
      data: countries,
    };
  }
}
