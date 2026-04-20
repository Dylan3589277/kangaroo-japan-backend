// serverless handler for NestJS on Vercel
const serverless = require('serverless-http');
const express = require('express');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { ExpressAdapter } = require('@nestjs/platform-express');
const expressApp = express();

let nestApp = null;
let handler = null;

async function createNestApp() {
  if (nestApp) return nestApp;
  
  try {
    console.log('Creating NestJS app...');
    nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
    console.log('NestJS app created');
    
    nestApp.enableCors({
      origin: '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
    });
    console.log('CORS enabled');

    await nestApp.init();
    console.log('NestJS app initialized');
    return nestApp;
  } catch (error) {
    console.error('Error creating NestJS app:', error);
    throw error;
  }
}

async function getHandler() {
  if (!handler) {
    await createNestApp();
    handler = serverless(expressApp);
  }
  return handler;
}

module.exports = async (event, context) => {
  try {
    const h = await getHandler();
    return h(event, context);
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        stack: error.stack
      })
    };
  }
};
