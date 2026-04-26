import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type Redis from 'ioredis';
import { HealthResponseDto, ServiceStatus } from './dto/health-response.dto';
import { HEALTH_REDIS_CLIENT } from './health.constants';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json') as { version: string };

const DB_TIMEOUT_MS = 5000;
const REDIS_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
    ),
  ]);
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(HEALTH_REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthResponseDto> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const allUp = database.status === 'up' && redis.status === 'up';

    return {
      status: allUp ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      version,
      uptime: process.uptime(),
      services: { database, redis },
    };
  }

  private async checkDatabase(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      await withTimeout(this.dataSource.query('SELECT 1'), DB_TIMEOUT_MS);
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Database health check failed: ${message}`);
      return { status: 'down', error: message };
    }
  }

  private async checkRedis(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      await withTimeout(this.redis.ping(), REDIS_TIMEOUT_MS);
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Redis health check failed: ${message}`);
      return { status: 'down', error: message };
    }
  }
}
