import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import serverless from 'serverless-http';
import express from 'express';

const app = express();

async function createNestApp() {
  const nestApp = await NestFactory.create(
    AppModule,
    new ExpressAdapter(app),
  );

  nestApp.enableCors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
  });

  await nestApp.init();
  return nestApp;
}

let handler: any;

async function getHandler() {
  if (!handler) {
    await createNestApp();
    handler = serverless(app);
  }
  return handler;
}

export default async (event: any, context: any) => {
  const h = await getHandler();
  return h(event, context);
};
