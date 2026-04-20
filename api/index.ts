// Custom serverless wrapper with full NestJS initialization
import serverless from 'serverless-http';
import express, { Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';

const expressApp = express();
let handler: any;

async function createNestApp() {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { bodyParser: false }
  );
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  app.enableCors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
  });

  await app.init();
  return app;
}

async function getHandler() {
  if (!handler) {
    await createNestApp();
    handler = serverless(expressApp, {
      request: (request: any, event: any) => {
        request.event = event;
        request.context = event.requestContext;
      }
    });
  }
  return handler;
}

export async function handler(event: any, context: any) {
  try {
    const h = await getHandler();
    return h(event, context);
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
}
