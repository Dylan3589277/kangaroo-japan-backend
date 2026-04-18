// Polyfill for crypto.randomUUID in CommonJS context
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.randomUUID) {
  // @ts-ignore
  globalThis.crypto = require('crypto');
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

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
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language', 'stripe-signature'],
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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Kangaroo Japan Backend running on http://localhost:${port}`);
}
bootstrap();
