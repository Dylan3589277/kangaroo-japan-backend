// Simple serverless wrapper for NestJS on Vercel
const serverless = require('serverless-http');
const express = require('express');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { ExpressAdapter } = require('@nestjs/platform-express');
const expressApp = express();

let nestApp = null;
let handler = null;

async function initNestApp() {
  if (nestApp) return nestApp;
  
  try {
    nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
    
    nestApp.enableCors({
      origin: '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
    });

    await nestApp.init();
    return nestApp;
  } catch (error) {
    console.error('NestJS init error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

async function getHandler() {
  if (!handler) {
    await initNestApp();
    handler = serverless(expressApp);
  }
  return handler;
}

// Health check endpoint
expressApp.get('/api/health', async (req, res) => {
  try {
    await initNestApp();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      hostname: error.hostname
    });
  }
});

module.exports = async (event, context) => {
  // Warmup request
  if (event.source === 'serverless-plugin-warmup') {
    return { statusCode: 200, body: JSON.stringify({ message: 'Warmup ok' }) };
  }
  
  try {
    const h = await getHandler();
    return h(event, context);
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Function error',
        message: error.message,
        stack: error.stack,
        code: error.code
      })
    };
  }
};
