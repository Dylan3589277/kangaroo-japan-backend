import { AppModule } from '../src/app.module';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverless from 'serverless-http';
import express from 'express';

const expressApp = express();
let handler: serverless.ServerlessHandler | undefined;

async function createHandler() {
  if (!handler) {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
    );

    app.enableCors({
      origin: '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
    });

    await app.init();
    handler = serverless(app) as serverless.ServerlessHandler;
  }
  return handler;
}

export async function handler(req: express.Request, res: express.Response) {
  const h = await createHandler();
  return h(req, res);
}
