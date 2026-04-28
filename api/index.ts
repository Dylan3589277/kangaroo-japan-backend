// Vercel serverless entry point with NestJS
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Application, Request, Response } from 'express';

let cachedApp: Application | null = null;
let initPromise: Promise<Application> | null = null;

async function initExpressApp(): Promise<Application> {
  if (cachedApp) return cachedApp;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const expressApp = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
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

    // Do not set a global prefix here. Controllers already include "api/v1"
    // in their @Controller() decorators, matching src/main.ts. Setting it here
    // would make Vercel routes become /api/v1/api/v1/... and break production APIs.

    await app.init();

    cachedApp = expressApp;
    return expressApp;
  })();

  return initPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await initExpressApp();
    return app(req, res);
  } catch (error: unknown) {
    console.error('Handler error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({
      statusCode: 500,
      message,
    });
  }
}
