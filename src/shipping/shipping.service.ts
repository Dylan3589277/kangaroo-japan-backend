/**
 * 国际运费估算服务
 * 支持：日本邮政 EMS/SAL/海运、Yamato UPS
 * 路线：日本 → 中国
 */

export interface ShippingOption {
  carrier: string;       // 承运商
  method: string;        // 运送方式
  priceJpy: number;     // 日元价格
  estimatedDays: {       // 预计送达天数
    min: number;
    max: number;
  };
  currency: string;
}

export interface ShippingEstimateRequest {
  weightKg: number;     // 重量（kg）
  destinationCountry?: string;  // 目的地（默认中国）
}

// 日本邮政 EMS 中国（第1区）费率表
const EMS_RATES_CHINA: Record<string, number> = {
  '0.5': 1450,
  '1': 2200,
  '1.5': 2800,
  '2': 3400,
  '2.5': 3900,
  '3': 4400,
  '3.5': 4900,
  '4': 5400,
  '4.5': 5900,
  '5': 6400,
  '6': 7400,
  '7': 8200,
  '8': 9000,
  '9': 9800,
  '10': 10600,
  '11': 11400,
  '12': 12200,
  '13': 13000,
  '14': 13800,
  '15': 14600,
  '16': 15400,
  '17': 16200,
  '18': 17000,
  '19': 17800,
  '20': 18600,
  '21': 19400,
  '22': 20200,
  '23': 21000,
  '24': 21800,
  '25': 22600,
  '26': 23400,
  '27': 24200,
  '28': 25000,
  '29': 25800,
  '30': 26600,
};

// SAL 运费（中国）- 大约是 EMS 的 60-70%
const SAL_RATES_CHINA: Record<string, number> = {
  '1': 1550,
  '2': 2400,
  '3': 3100,
  '4': 3800,
  '5': 4500,
  '6': 5200,
  '7': 5900,
  '8': 6600,
  '9': 7300,
  '10': 8000,
  '15': 10500,
  '20': 13000,
  '25': 15500,
  '30': 18000,
};

// 海运运费（中国）- 大约是 EMS 的 30-40%
const SEA_RATES_CHINA: Record<string, number> = {
  '1': 800,
  '2': 1200,
  '3': 1600,
  '4': 2000,
  '5': 2400,
  '6': 2800,
  '7': 3200,
  '8': 3600,
  '9': 4000,
  '10': 4400,
  '15': 5800,
  '20': 7200,
  '25': 8600,
  '30': 10000,
};

// Yamato UPS 费率表（中国）- 仅供参考
const YAMATO_RATES_CHINA: Record<string, number> = {
  '1': 2400,
  '2': 3200,
  '3': 4000,
  '4': 4800,
  '5': 5600,
  '6': 6400,
  '7': 7200,
  '8': 8000,
  '9': 8800,
  '10': 9600,
  '15': 13000,
  '20': 16000,
  '25': 19000,
  '30': 22000,
};

// 根据重量获取费率（向上取整到最接近的重量档位）
function getRateForWeight(rates: Record<string, number>, weightKg: number): number {
  // 找到最接近的重量档位
  const weightStr = weightKg.toString();
  
  // 直接匹配
  if (rates[weightStr]) {
    return rates[weightStr];
  }
  
  // 重量小于最小档位
  const weights = Object.keys(rates).map(w => parseFloat(w)).sort((a, b) => a - b);
  const minWeight = weights[0];
  const maxWeight = weights[weights.length - 1];
  
  if (weightKg <= minWeight) {
    return rates[minWeight.toString()];
  }
  
  if (weightKg >= maxWeight) {
    // 超过最大档位，按比例估算
    const baseRate = rates[maxWeight.toString()];
    const baseWeight = maxWeight;
    return Math.ceil(baseRate * (weightKg / baseWeight));
  }
  
  // 线性插值估算
  for (let i = 0; i < weights.length - 1; i++) {
    const w1 = weights[i];
    const w2 = weights[i + 1];
    if (weightKg > w1 && weightKg <= w2) {
      const r1 = rates[w1.toString()];
      const r2 = rates[w2.toString()];
      const ratio = (weightKg - w1) / (w2 - w1);
      return Math.ceil(r1 + (r2 - r1) * ratio);
    }
  }
  
  // 默认返回最高档位费率
  return rates[maxWeight.toString()];
}

export class ShippingService {
  /**
   * 获取运费估算选项
   */
  async getShippingOptions(req: ShippingEstimateRequest): Promise<ShippingOption[]> {
    const { weightKg = 1, destinationCountry = 'CN' } = req;
    
    // 目前仅支持中国
    const options: ShippingOption[] = [];
    
    // EMS
    options.push({
      carrier: '日本邮政',
      method: 'EMS',
      priceJpy: getRateForWeight(EMS_RATES_CHINA, weightKg),
      estimatedDays: { min: 3, max: 7 },
      currency: 'JPY',
    });
    
    // SAL（经济航空）
    const salRate = getRateForWeight(SAL_RATES_CHINA, weightKg);
    if (salRate > 0) {
      options.push({
        carrier: '日本邮政',
        method: 'SAL（经济航空）',
        priceJpy: salRate,
        estimatedDays: { min: 7, max: 14 },
        currency: 'JPY',
      });
    }
    
    // 海运
    const seaRate = getRateForWeight(SEA_RATES_CHINA, weightKg);
    if (seaRate > 0) {
      options.push({
        carrier: '日本邮政',
        method: '海运',
        priceJpy: seaRate,
        estimatedDays: { min: 20, max: 40 },
        currency: 'JPY',
      });
    }
    
    // Yamato UPS
    options.push({
      carrier: 'ヤマト運輸',
      method: '国際宅急便（UPS）',
      priceJpy: getRateForWeight(YAMATO_RATES_CHINA, weightKg),
      estimatedDays: { min: 2, max: 5 },
      currency: 'JPY',
    });
    
    return options;
  }
  
  /**
   * 获取最便宜的选项
   */
  async getCheapestOption(req: ShippingEstimateRequest): Promise<ShippingOption | null> {
    const options = await this.getShippingOptions(req);
    if (options.length === 0) return null;
    return options.reduce((cheapest, current) => 
      current.priceJpy < cheapest.priceJpy ? current : cheapest
    );
  }
  
  /**
   * 获取最快到达的选项
   */
  async getFastestOption(req: ShippingEstimateRequest): Promise<ShippingOption | null> {
    const options = await this.getShippingOptions(req);
    if (options.length === 0) return null;
    return options.reduce((fastest, current) => 
      current.estimatedDays.min < fastest.estimatedDays.min ? current : fastest
    );
  }
  
  /**
   * 将日元价格转换为人民币（估算）
   * 假设汇率 0.0468（100JPY = 4.68CNY）
   */
  async convertToCny(priceJpy: number): Promise<number> {
    const RATE = 0.0468; // 日元兑人民币汇率
    return Math.ceil(priceJpy * RATE * 100) / 100;
  }
}
