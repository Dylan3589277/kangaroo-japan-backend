import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HEALTH_REDIS_CLIENT } from './health.constants';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: HEALTH_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        if (url) return new Redis(url);
        return new Redis({
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        });
      },
    },
    HealthService,
  ],
})
export class HealthModule {}
