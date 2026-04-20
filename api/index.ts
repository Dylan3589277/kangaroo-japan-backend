import { AppModule } from '../dist/app.module';
import { NestFactory } from '@nestjs/core';
import serverless from 'serverless-http';
import express from 'express';
import '@nestjs/config';

const app = express();

async function createNestApp() {
  const nestApp = await NestFactory.create(AppModule, new (require('@nestjs/platform-express')).ExpressAdapter(app));
  
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
