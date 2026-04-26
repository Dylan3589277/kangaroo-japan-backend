import { Injectable } from '@nestjs/common';

export interface MetricCard {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'green' | 'yellow' | 'red';
  threshold: { yellow: number; red: number };
  trend: number;
  trendDirection: 'up' | 'down';
}

export interface Alert {
  id: string;
  metricId: string;
  metricName: string;
  module: 'hr' | 'finance' | 'supply_chain' | 'operation' | 'influencer';
  status: 'green' | 'yellow' | 'red';
  threshold: number;
  currentValue: number;
  assignee: string;
  createdAt: string;
  deadline: string;
  handlingResult?: string;
  handler?: string;
  resolvedAt?: string;
}

export interface TrendDataPoint {
  date: string;
  value: number;
}

export interface ModuleData {
  id: string;
  name: string;
  metrics: MetricCard[];
  alerts: Alert[];
  trendData: Record<string, TrendDataPoint[]>;
}

export interface OverviewData {
  metrics: MetricCard[];
  alerts: Alert[];
  trendData: Record<string, TrendDataPoint[]>;
}

function generateTrendData(days: number, baseValue: number, variance: number): TrendDataPoint[] {
  const data: TrendDataPoint[] = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const value = baseValue + (Math.random() - 0.5) * variance * 2;
    data.push({ date: date.toISOString().split('T')[0], value: Math.round(value * 100) / 100 });
  }
  return data;
}

const coreMetrics: MetricCard[] = [
  {
    id: 'profit-per-capita',
    name: '人均毛利',
    value: 45800,
    unit: 'JPY',
    status: 'green',
    threshold: { yellow: 35000, red: 25000 },
    trend: 12.5,
    trendDirection: 'up',
  },
  {
    id: 'inventory-turnover',
    name: '库存周转率',
    value: 8.2,
    unit: '次',
    status: 'green',
    threshold: { yellow: 6, red: 4 },
    trend: 5.3,
    trendDirection: 'up',
  },
  {
    id: 'gross-margin',
    name: '整体毛利率',
    value: 32.5,
    unit: '%',
    status: 'yellow',
    threshold: { yellow: 35, red: 25 },
    trend: -2.1,
    trendDirection: 'down',
  },
  {
    id: 'ad-tacos',
    name: '广告TACoS',
    value: 18.2,
    unit: '%',
    status: 'red',
    threshold: { yellow: 15, red: 20 },
    trend: 3.5,
    trendDirection: 'up',
  },
  {
    id: 'cash-flow-health',
    name: '现金流健康度',
    value: 85,
    unit: '%',
    status: 'green',
    threshold: { yellow: 70, red: 50 },
    trend: 8.0,
    trendDirection: 'up',
  },
];

const alerts: Alert[] = [
  {
    id: 'alert-001',
    metricId: 'ad-tacos',
    metricName: '广告TACoS',
    module: 'operation',
    status: 'red',
    threshold: 20,
    currentValue: 18.2,
    assignee: '张明',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    deadline: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: 'alert-002',
    metricId: 'gross-margin',
    metricName: '整体毛利率',
    module: 'finance',
    status: 'yellow',
    threshold: 35,
    currentValue: 32.5,
    assignee: '李华',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
  },
  {
    id: 'alert-003',
    metricId: 'inventory-overstock',
    metricName: '库存积压率',
    module: 'supply_chain',
    status: 'yellow',
    threshold: 15,
    currentValue: 12.3,
    assignee: '王芳',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    deadline: new Date(Date.now() + 4 * 86400000).toISOString(),
  },
  {
    id: 'alert-004',
    metricId: 'influencer-roi',
    metricName: '红人ROI',
    module: 'influencer',
    status: 'red',
    threshold: 2.5,
    currentValue: 1.8,
    assignee: '赵伟',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    deadline: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'alert-005',
    metricId: 'staff-turnover',
    metricName: '员工离职率',
    module: 'hr',
    status: 'yellow',
    threshold: 8,
    currentValue: 6.5,
    assignee: '刘强',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
  },
];

const moduleDataMap: Record<string, ModuleData> = {
  hr: {
    id: 'hr',
    name: '人事模块',
    metrics: [
      { id: 'staff-count', name: '在职员工数', value: 45, unit: '人', status: 'green', threshold: { yellow: 35, red: 25 }, trend: 2.3, trendDirection: 'up' },
      { id: 'staff-turnover', name: '员工离职率', value: 6.5, unit: '%', status: 'yellow', threshold: { yellow: 8, red: 12 }, trend: -1.2, trendDirection: 'down' },
      { id: 'avg-salary', name: '平均薪资', value: 380000, unit: 'JPY', status: 'green', threshold: { yellow: 420000, red: 450000 }, trend: 3.5, trendDirection: 'up' },
      { id: 'training-hours', name: '人均培训时长', value: 24, unit: '小时/月', status: 'green', threshold: { yellow: 20, red: 15 }, trend: 15.0, trendDirection: 'up' },
      { id: 'satisfaction', name: '员工满意度', value: 82, unit: '%', status: 'green', threshold: { yellow: 75, red: 65 }, trend: 5.0, trendDirection: 'up' },
    ],
    alerts: alerts.filter((a) => a.module === 'hr'),
    trendData: {
      'staff-count': generateTrendData(30, 43, 5),
      'staff-turnover': generateTrendData(30, 7, 2),
      'avg-salary': generateTrendData(30, 375000, 20000),
    },
  },
  finance: {
    id: 'finance',
    name: '财务模块',
    metrics: [
      { id: 'revenue', name: '月营收', value: 28500000, unit: 'JPY', status: 'green', threshold: { yellow: 25000000, red: 20000000 }, trend: 18.5, trendDirection: 'up' },
      { id: 'gross-margin', name: '毛利率', value: 32.5, unit: '%', status: 'yellow', threshold: { yellow: 35, red: 25 }, trend: -2.1, trendDirection: 'down' },
      { id: 'net-margin', name: '净利率', value: 12.8, unit: '%', status: 'green', threshold: { yellow: 10, red: 5 }, trend: 1.5, trendDirection: 'up' },
      { id: 'expense-ratio', name: '费用率', value: 18.5, unit: '%', status: 'green', threshold: { yellow: 22, red: 28 }, trend: -3.2, trendDirection: 'down' },
      { id: 'tax-burden', name: '税负率', value: 5.2, unit: '%', status: 'green', threshold: { yellow: 8, red: 10 }, trend: 0.3, trendDirection: 'up' },
    ],
    alerts: alerts.filter((a) => a.module === 'finance'),
    trendData: {
      revenue: generateTrendData(90, 27000000, 3000000),
      'gross-margin': generateTrendData(90, 33, 5),
      'net-margin': generateTrendData(90, 12, 3),
    },
  },
  supply_chain: {
    id: 'supply_chain',
    name: '供应链模块',
    metrics: [
      { id: 'inventory-turnover', name: '库存周转率', value: 8.2, unit: '次', status: 'green', threshold: { yellow: 6, red: 4 }, trend: 5.3, trendDirection: 'up' },
      { id: 'inventory-overstock', name: '库存积压率', value: 12.3, unit: '%', status: 'yellow', threshold: { yellow: 15, red: 25 }, trend: -8.5, trendDirection: 'down' },
      { id: 'delivery-rate', name: '准时交货率', value: 96.5, unit: '%', status: 'green', threshold: { yellow: 92, red: 85 }, trend: 2.1, trendDirection: 'up' },
      { id: 'supplier-count', name: '活跃供应商数', value: 28, unit: '家', status: 'green', threshold: { yellow: 20, red: 15 }, trend: 12.0, trendDirection: 'up' },
      { id: 'defect-rate', name: '次品率', value: 0.8, unit: '%', status: 'green', threshold: { yellow: 1.5, red: 3 }, trend: -0.2, trendDirection: 'down' },
    ],
    alerts: alerts.filter((a) => a.module === 'supply_chain'),
    trendData: {
      'inventory-turnover': generateTrendData(30, 8, 1.5),
      'inventory-overstock': generateTrendData(30, 13, 4),
      'delivery-rate': generateTrendData(30, 95, 3),
    },
  },
  operation: {
    id: 'operation',
    name: '运营模块',
    metrics: [
      { id: 'ad-tacos', name: '广告TACoS', value: 18.2, unit: '%', status: 'red', threshold: { yellow: 15, red: 20 }, trend: 3.5, trendDirection: 'up' },
      { id: 'conversion-rate', name: '转化率', value: 4.8, unit: '%', status: 'green', threshold: { yellow: 3.5, red: 2.5 }, trend: 0.8, trendDirection: 'up' },
      { id: 'avg-order-value', name: '客单价', value: 12800, unit: 'JPY', status: 'green', threshold: { yellow: 10000, red: 8000 }, trend: 6.5, trendDirection: 'up' },
      { id: 'review-score', name: '评分', value: 4.6, unit: '分', status: 'green', threshold: { yellow: 4.2, red: 3.8 }, trend: 0.2, trendDirection: 'up' },
      { id: 'return-rate', name: '退货率', value: 2.1, unit: '%', status: 'green', threshold: { yellow: 3.5, red: 5 }, trend: -0.5, trendDirection: 'down' },
    ],
    alerts: alerts.filter((a) => a.module === 'operation'),
    trendData: {
      'ad-tacos': generateTrendData(30, 17, 4),
      'conversion-rate': generateTrendData(30, 4.5, 1),
      'avg-order-value': generateTrendData(30, 12500, 1500),
    },
  },
  influencer: {
    id: 'influencer',
    name: '红人模块',
    metrics: [
      { id: 'influencer-count', name: '合作红人数', value: 156, unit: '人', status: 'green', threshold: { yellow: 120, red: 80 }, trend: 25.0, trendDirection: 'up' },
      { id: 'influencer-roi', name: '红人ROI', value: 1.8, unit: '倍', status: 'red', threshold: { yellow: 2.5, red: 2 }, trend: -0.5, trendDirection: 'down' },
      { id: 'avg-engagement', name: '平均互动率', value: 3.2, unit: '%', status: 'green', threshold: { yellow: 2.5, red: 1.5 }, trend: 0.8, trendDirection: 'up' },
      { id: 'content-count', name: '内容产出数', value: 428, unit: '篇/月', status: 'green', threshold: { yellow: 300, red: 200 }, trend: 35.0, trendDirection: 'up' },
      { id: 'brand-mentions', name: '品牌提及数', value: 1850, unit: '次/月', status: 'green', threshold: { yellow: 1200, red: 800 }, trend: 42.0, trendDirection: 'up' },
    ],
    alerts: alerts.filter((a) => a.module === 'influencer'),
    trendData: {
      'influencer-count': generateTrendData(30, 140, 25),
      'influencer-roi': generateTrendData(30, 2.2, 0.6),
      'avg-engagement': generateTrendData(30, 3.0, 0.8),
    },
  },
};

const overviewData: OverviewData = {
  metrics: coreMetrics,
  alerts: alerts,
  trendData: {
    'profit-per-capita': generateTrendData(90, 42000, 8000),
    'inventory-turnover': generateTrendData(90, 7.8, 1.5),
    'gross-margin': generateTrendData(90, 33, 5),
    'ad-tacos': generateTrendData(90, 16, 5),
    'cash-flow-health': generateTrendData(90, 82, 10),
  },
};

@Injectable()
export class DashboardService {
  async getOverview(): Promise<OverviewData> {
    return overviewData;
  }

  async getModuleData(module: string): Promise<ModuleData | null> {
    return moduleDataMap[module] || null;
  }

  async getAlerts(filters?: { status?: string; module?: string; dateRange?: string }): Promise<Alert[]> {
    let result = [...alerts];
    if (filters?.status && filters.status !== 'all') {
      result = result.filter((a) => a.status === filters.status);
    }
    if (filters?.module && filters.module !== 'all') {
      result = result.filter((a) => a.module === filters.module);
    }
    return result;
  }

  async resolveAlert(alertId: string, result: string, handler: string): Promise<void> {
    const alert = alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolvedAt = new Date().toISOString();
      alert.handler = handler;
      alert.handlingResult = result;
    }
  }
}
