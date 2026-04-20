import { registerAs } from '@nestjs/config';

export default registerAs('exchange', () => ({
  // 日元转人民币汇率 (JPY → CNY)
  jpyToCny: process.env.EXCHANGE_RATE_JPY_CNY 
    ? parseFloat(process.env.EXCHANGE_RATE_JPY_CNY) 
    : 0.05,
  
  // 日元转美元汇率 (JPY → USD)
  jpyToUsd: process.env.EXCHANGE_RATE_JPY_USD 
    ? parseFloat(process.env.EXCHANGE_RATE_JPY_USD) 
    : 0.0067,
  
  // 人民币转美元汇率 (CNY → USD)
  cnyToUsd: process.env.EXCHANGE_RATE_CNY_USD 
    ? parseFloat(process.env.EXCHANGE_RATE_CNY_USD) 
    : 0.14,
  
  // 汇率更新时间戳
  lastUpdated: process.env.EXCHANGE_RATE_UPDATED_AT || new Date().toISOString(),
}));
