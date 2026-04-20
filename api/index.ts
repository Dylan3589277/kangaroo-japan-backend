// Vercel serverless entry point with NestJS
import serverlessHttp from 'serverless-http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

let cachedHandler: any;
let initPromise: Promise<any>;

async function initHandler() {
  if (cachedHandler) return cachedHandler;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const expressApp = express();

    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
      rawBody: true,
    });

    expressApp.use(express.json());
    expressApp.use(express.urlencoded({ extended: true }));

    app.enableCors({
      origin: '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language', 'stripe-signature'],
    });

    await app.init();

    cachedHandler = serverlessHttp(app);
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
