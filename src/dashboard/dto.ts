export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

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

export interface OverviewDto {
  metrics: MetricCard[];
  alerts: Alert[];
  trendData: Record<string, TrendDataPoint[]>;
}

export interface ModuleDataDto {
  id: string;
  name: string;
  metrics: MetricCard[];
  alerts: Alert[];
  trendData: Record<string, TrendDataPoint[]>;
}

export interface AlertsDto {
  alerts: Alert[];
}

export class ResolveAlertDto {
  alertId: string;
  result: string;
  handler: string;
}
