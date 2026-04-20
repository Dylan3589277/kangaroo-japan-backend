// eslint-disable-next-line @typescript-eslint/no-var-requires
const serverless = require('serverless-http');
import { AppModule } from '../src/app.module';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Request, Response } from 'express';

const expressApp = express();
let serverlessHandler: any;

async function createServerlessHandler() {
  if (!serverlessHandler) {
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
    serverlessHandler = serverless(app);
  }
  return serverlessHandler;
}

export async function handler(req: Request, res: Response) {
  const h = await createServerlessHandler();
  return h(req, res);
}
