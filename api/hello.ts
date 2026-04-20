import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import serverless from 'serverless-http';
import express from 'express';

const app = express();
const server = express();

server.use(express.json());

// Create NestJS app
async function createNestApp() {
  const nestApp = await NestFactory.create(
    AppModule,
    new ExpressAdapter(server),
  );
  
  nestApp.enableCors({
    origin: '*',
    credentials: true,
  });
  
  await nestApp.init();
  return nestApp;
}

let handler: any;

async function getHandler() {
  if (!handler) {
    await createNestApp();
    handler = serverless(server, {
      request: (request: any, event: any) => {
        request.event = event;
      },
    });
  }
  return handler;
}

exports.handler = async (event: any, context: any) => {
  const h = await getHandler();
  return h(event, context);
};
