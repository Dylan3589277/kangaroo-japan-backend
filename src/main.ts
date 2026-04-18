// Polyfill for crypto.randomUUID in CommonJS context
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.randomUUID) {
  // @ts-expect-error: Polyfill for older Node versions
  globalThis.crypto = require('crypto');
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { json } from 'express';
import { runAllSeeds } from './database/seeds/index';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Run seeds if RUN_SEED environment variable is set
  if (process.env.RUN_SEED === 'true') {
    console.log('🌱 Running database seeds...');
    try {
      const dataSource = new DataSource({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
      });
      await dataSource.initialize();
      await runAllSeeds(dataSource);
      await dataSource.destroy();
      console.log('✅ Seeds completed successfully!');
    } catch (error) {
      console.error('❌ Seed failed:', error);
    }
    // Exit after seeding
    process.exit(0);
  }

  // Use raw body parser for Stripe webhooks (needs raw body Buffer)
  app.use(
    json({
      verify: (req: any, _res, buf) => {
        // Store raw body for Stripe webhook signature verification
        if (req.url === '/api/payments/webhook/stripe') {
          req.rawBody = buf;
        }
      },
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept-Language',
      'stripe-signature',
    ],
  });

  // Parse cookies
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // API prefix removed - controllers already include api/v1/ path

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Kangaroo Japan Backend running on http://localhost:${port}`);
}
bootstrap();
