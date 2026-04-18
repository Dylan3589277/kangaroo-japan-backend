/**
 * 国际运费估算服务
 * 支持：日本邮政 EMS/SAL/海运 → 全球主要地区
 * 路线：日本 → 中国/港台/韩国/美国/欧洲等
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
  country?: string;     // 目的地国家代码 (CN/TW/HK/KR/US/DE等)
  countryName?: string;  // 目的地名称（用于显示）
}

// 地区配置
export interface RegionConfig {
  name: string;
  zone: number;         // 日本邮政分区 1-5
  code: string;          // ISO代码
}

// 支持的地区
export const SUPPORTED_REGIONS: RegionConfig[] = [
  { name: "中国", zone: 1, code: "CN" },
  { name: "香港", zone: 1, code: "HK" },
  { name: "澳门", zone: 1, code: "MO" },
  { name: "台湾", zone: 1, code: "TW" },
  { name: "韩国", zone: 1, code: "KR" },
  { name: "蒙古", zone: 2, code: "MN" },
  { name: "朝鲜", zone: 2, code: "KP" },
  { name: "美国", zone: 3, code: "US" },
  { name: "加拿大", zone: 3, code: "CA" },
  { name: "墨西哥", zone: 3, code: "MX" },
  { name: "英国", zone: 4, code: "GB" },
  { name: "德国", zone: 4, code: "DE" },
  { name: "法国", zone: 4, code: "FR" },
  { name: "意大利", zone: 4, code: "IT" },
  { name: "西班牙", zone: 4, code: "ES" },
  { name: "荷兰", zone: 4, code: "NL" },
  { name: "瑞士", zone: 4, code: "CH" },
  { name: "俄罗斯", zone: 4, code: "RU" },
  { name: "澳大利亚", zone: 2, code: "AU" },
  { name: "新西兰", zone: 2, code: "NZ" },
  { name: "新加坡", zone: 1, code: "SG" },
  { name: "马来西亚", zone: 1, code: "MY" },
  { name: "泰国", zone: 1, code: "TH" },
  { name: "印度尼西亚", zone: 2, code: "ID" },
  { name: "菲律宾", zone: 2, code: "PH" },
  { name: "越南", zone: 2, code: "VN" },
  { name: "印度", zone: 2, code: "IN" },
  { name: "巴西", zone: 5, code: "BR" },
  { name: "阿根廷", zone: 5, code: "AR" },
];

// 日本邮政 EMS 费率表（按地区分区）
// Zone 1: 中国/韩国/台湾/香港/澳门
// Zone 2: 亚洲（中国/韩国/台湾/香港/澳门除外）
// Zone 3: 大洋洲/加拿大/墨西哥/中东/欧洲
// Zone 4: 美国（含关岛等海外领土）
// Zone 5: 中南美/非洲

const EMS_RATES: Record<number, Record<string, number>> = {
  // Zone 1
  1: {
    '0.5': 1450, '1': 2200, '1.5': 2800, '2': 3400, '2.5': 3900,
    '3': 4400, '3.5': 4900, '4': 5400, '4.5': 5900, '5': 6400,
    '6': 7400, '7': 8200, '8': 9000, '9': 9800, '10': 10600,
    '11': 11400, '12': 12200, '13': 13000, '14': 13800, '15': 14600,
    '16': 15400, '17': 16200, '18': 17000, '19': 17800, '20': 18600,
    '21': 19400, '22': 20200, '23': 21000, '24': 21800, '25': 22600,
    '26': 23400, '27': 24200, '28': 25000, '29': 25800, '30': 26600,
  },
  // Zone 2
  2: {
    '0.5': 1900, '1': 3150, '1.5': 3850, '2': 4400, '2.5': 5150,
    '3': 5750, '3.5': 6350, '4': 6950, '4.5': 7550, '5': 8150,
    '6': 9350, '7': 10350, '8': 11350, '9': 12350, '10': 13350,
    '11': 14350, '12': 15350, '13': 16350, '14': 17350, '15': 18350,
    '16': 19350, '17': 20350, '18': 21350, '19': 22350, '20': 23350,
    '21': 24350, '22': 25350, '23': 26350, '24': 27350, '25': 28350,
    '26': 29350, '27': 30350, '28': 31350, '29': 32350, '30': 33350,
  },
  // Zone 3
  3: {
    '0.5': 3150, '1': 4400, '1.5': 5550, '2': 6700, '2.5': 7750,
    '3': 8800, '3.5': 9850, '4': 10900, '4.5': 11950, '5': 13000,
    '6': 15100, '7': 17200, '8': 19300, '9': 21400, '10': 23500,
    '11': 25600, '12': 27700, '13': 29800, '14': 31900, '15': 34000,
    '16': 36100, '17': 38200, '18': 40300, '19': 42400, '20': 44500,
    '21': 46600, '22': 48700, '23': 50800, '24': 52900, '25': 55000,
    '26': 57100, '27': 59200, '28': 61300, '29': 63400, '30': 65500,
  },
  // Zone 4
  4: {
    '0.5': 3900, '1': 5100, '1.5': 6600, '2': 7900, '2.5': 9100,
    '3': 10300, '3.5': 11600, '4': 12700, '4.5': 13900, '5': 15100,
    '6': 17500, '7': 19900, '8': 22300, '9': 24700, '10': 27100,
    '11': 29500, '12': 31900, '13': 34300, '14': 36700, '15': 39100,
    '16': 41500, '17': 43900, '18': 46300, '19': 48700, '20': 51100,
    '21': 53500, '22': 55900, '23': 58300, '24': 60700, '25': 63100,
    '26': 65500, '27': 67900, '28': 70300, '29': 72700, '30': 75100,
  },
  // Zone 5
  5: {
    '0.5': 3900, '1': 5600, '1.5': 7300, '2': 8900, '2.5': 10600,
    '3': 11100, '3.5': 12600, '4': 14100, '4.5': 15600, '5': 17100,
    '6': 20100, '7': 22500, '8': 24900, '9': 27300, '10': 29700,
    '11': 32100, '12': 34500, '13': 36900, '14': 39300, '15': 41700,
    '16': 44100, '17': 46500, '18': 48900, '19': 51300, '20': 53700,
    '21': 56100, '22': 58500, '23': 60900, '24': 63300, '25': 65700,
    '26': 68100, '27': 70500, '28': 72900, '29': 75300, '30': 77700,
  },
};

// SAL 运费（中国/亚洲）- 大约是 EMS 的 60-70%
const SAL_RATES: Record<string, number> = {
  '0.5': 1000, '1': 1550, '2': 2400, '3': 3100, '4': 3800,
  '5': 4500, '6': 5200, '7': 5900, '8': 6600, '9': 7300,
  '10': 8000, '15': 10500, '20': 13000, '25': 15500, '30': 18000,
};

// 海运运费 - 大约是 EMS 的 30-40%
const SEA_RATES: Record<string, number> = {
  '0.5': 550, '1': 800, '2': 1200, '3': 1600, '4': 2000,
  '5': 2400, '6': 2800, '7': 3200, '8': 3600, '9': 4000,
  '10': 4400, '15': 5800, '20': 7200, '25': 8600, '30': 10000,
};

// 根据重量获取费率
function getRateForWeight(rates: Record<string, number>, weightKg: number): number {
  const weightStr = weightKg.toString();
  
  if (rates[weightStr]) {
    return rates[weightStr];
  }
  
  const weights = Object.keys(rates).map(w => parseFloat(w)).sort((a, b) => a - b);
  const minWeight = weights[0];
  const maxWeight = weights[weights.length - 1];
  
  if (weightKg <= minWeight) {
    return rates[minWeight.toString()];
  }
  
  if (weightKg >= maxWeight) {
    const baseRate = rates[maxWeight.toString()];
    const baseWeight = maxWeight;
    return Math.ceil(baseRate * (weightKg / baseWeight));
  }
  
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
  
  return rates[maxWeight.toString()];
}

// 根据国家获取分区
function getZoneForCountry(countryCode: string): number {
  const region = SUPPORTED_REGIONS.find(r => r.code === countryCode.toUpperCase());
  return region ? region.zone : 2; // 默认 Zone 2
}

// 根据国家获取名称
function getCountryName(countryCode: string): string {
  const region = SUPPORTED_REGIONS.find(r => r.code === countryCode.toUpperCase());
  return region ? region.name : countryCode;
}

// 送达时间估算（按地区）
function getEstimatedDays(zone: number, method: 'EMS' | 'SAL' | 'SEA'): { min: number; max: number } {
  switch (method) {
    case 'EMS':
      switch (zone) {
        case 1: return { min: 3, max: 7 };
        case 2: return { min: 5, max: 10 };
        case 3: return { min: 6, max: 12 };
        case 4: return { min: 7, max: 14 };
        case 5: return { min: 10, max: 20 };
        default: return { min: 7, max: 14 };
      }
    case 'SAL':
      switch (zone) {
        case 1: return { min: 7, max: 14 };
        case 2: return { min: 14, max: 21 };
        case 3: return { min: 14, max: 28 };
        case 4: return { min: 21, max: 35 };
        case 5: return { min: 30, max: 50 };
        default: return { min: 14, max: 28 };
      }
    case 'SEA':
      return { min: 20, max: 40 };
    default:
      return { min: 7, max: 14 };
  }
}

export class ShippingService {
  /**
   * 获取运费估算选项
   */
  async getShippingOptions(req: ShippingEstimateRequest): Promise<ShippingOption[]> {
    const { weightKg = 1, country = 'CN' } = req;
    
    const zone = getZoneForCountry(country);
    const countryName = getCountryName(country);
    const options: ShippingOption[] = [];
    
    // EMS - Zone 1-5
    const zoneRates = EMS_RATES[zone] || EMS_RATES[2];
    const emsPrice = getRateForWeight(zoneRates, weightKg);
    options.push({
      carrier: '日本郵便',
      method: 'EMS',
      priceJpy: emsPrice,
      estimatedDays: getEstimatedDays(zone, 'EMS'),
      currency: 'JPY',
    });
    
    // SAL - 仅 Zone 1-2
    if (zone <= 2) {
      const salPrice = getRateForWeight(SAL_RATES, weightKg);
      options.push({
        carrier: '日本郵便',
        method: 'SAL（経済航空）',
        priceJpy: salPrice,
        estimatedDays: getEstimatedDays(zone, 'SAL'),
        currency: 'JPY',
      });
    }
    
    // 海运 - 所有区域
    const seaPrice = getRateForWeight(SEA_RATES, weightKg);
    options.push({
      carrier: '日本郵便',
      method: '船便',
      priceJpy: seaPrice,
      estimatedDays: getEstimatedDays(zone, 'SEA'),
      currency: 'JPY',
    });
    
    // UPS - Zone 1 (中国/东亚) 和 Zone 3 (美国)
    const upsMultiplier = zone <= 2 ? 1.0 : zone === 3 ? 1.3 : 1.5;
    const upsBasePrice = getRateForWeight(SEA_RATES, weightKg) * 3 * upsMultiplier;
    options.push({
      carrier: 'ヤマト運輸',
      method: '国際宅急便（UPS）',
      priceJpy: Math.ceil(upsBasePrice),
      estimatedDays: { min: 2, max: 5 },
      currency: 'JPY',
    });
    
    return options.map(opt => ({
      ...opt,
      countryName,
    })) as ShippingOption[];
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
   * 获取支持的国家列表
   */
  async getSupportedCountries(): Promise<{ code: string; name: string }[]> {
    return SUPPORTED_REGIONS.map(r => ({ code: r.code, name: r.name }));
  }
  
  /**
   * 将日元价格转换为人民币
   */
  async convertToCny(priceJpy: number): Promise<number> {
    const RATE = 0.0468;
    return Math.ceil(priceJpy * RATE * 100) / 100;
  }
  
  /**
   * 将日元价格转换为美元
   */
  async convertToUsd(priceJpy: number): Promise<number> {
    const RATE = 0.0067;
    return Math.ceil(priceJpy * RATE * 100) / 100;
  }
}
