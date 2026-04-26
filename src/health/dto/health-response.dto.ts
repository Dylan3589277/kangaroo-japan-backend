export interface ServiceStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

export interface HealthResponseDto {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
}
