// serverless handler for NestJS on Vercel
const serverless = require('serverless-http');
const express = require('express');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { ExpressAdapter } = require('@nestjs/platform-express');
const expressApp = express();

async function createNestApp() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  
  app.enableCors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
  });

  await app.init();
  return app;
}

let handler;

async function getHandler() {
  if (!handler) {
    await createNestApp();
    handler = serverless(expressApp);
  }
  return handler;
}

module.exports = async (event, context) => {
  const h = await getHandler();
  return h(event, context);
};
