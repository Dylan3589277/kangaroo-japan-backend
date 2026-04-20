// Vercel serverless entry point with NestJS
import serverlessHttp from 'serverless-http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Application } from 'express';

let cachedHandler: any;
let initPromise: Promise<any>;

async function initHandler() {
  if (cachedHandler) return cachedHandler;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const app = await NestFactory.create(AppModule, new ExpressAdapter(express()), {
      rawBody: true,
    });

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const allowedOrigins = process.env.FRONTEND_URL
      ? [process.env.FRONTEND_URL, 'http://localhost:3001', 'http://localhost:3000']
      : ['http://localhost:3001', 'http://localhost:3000'];
    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language', 'stripe-signature'],
    });

    // Set global prefix to match main.ts
    app.setGlobalPrefix('api/v1');

    await app.init();
    
    const expressApp = app.getHttpAdapter().getInstance() as Application;
    cachedHandler = serverlessHttp(expressApp);
    return cachedHandler;
  })();

  return initPromise;
}

export default async function handler(event: any, context: any) {
  try {
    const h = await initHandler();
    return h(event, context);
  } catch (error: any) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: error.message || 'Internal server error',
      }),
    };
  }
}
