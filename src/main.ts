import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { json, type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CacheControlInterceptor } from './common/cache-control.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Request ID middleware — attach unique UUID to every request/response
  app.use(
    (req: Request & { id?: string }, res: Response, next: NextFunction) => {
      const requestId = (req.headers['x-request-id'] as string) || uuidv4();
      req.id = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    },
  );

  // Accept-Language middleware — detect client language preference
  const supportedLocales = ['zh', 'en', 'ja', 'th', 'vi', 'id'];
  app.use(
    (req: Request, res: Response, next: NextFunction) => {
      const acceptLanguage = req.headers['accept-language'] || '';
      let detectedLocale = 'zh'; // default

      if (acceptLanguage) {
        // Parse Accept-Language header (e.g. "en-US,en;q=0.9,zh;q=0.8")
        const locales = acceptLanguage
          .split(',')
          .map((l) => {
            const [lang, q = '1'] = l.trim().split(';q=');
            return { lang: lang.split('-')[0].toLowerCase(), q: parseFloat(q) || 1 };
          })
          .sort((a, b) => b.q - a.q);

        for (const locale of locales) {
          if (supportedLocales.includes(locale.lang)) {
            detectedLocale = locale.lang;
            break;
          }
        }
      }

      res.setHeader('X-Content-Language', detectedLocale);
      // Also store on request for potential later use by controllers
      (req as any).detectedLocale = detectedLocale;
      next();
    },
  );

  // Use raw body parser for Stripe webhooks (needs raw body Buffer)
  app.use(
    json({
      verify: (
        req: Request & { rawBody?: Buffer },
        _res: Response,
        buf: Buffer,
      ) => {
        // Store raw body for Stripe webhook signature verification
        if (req.url?.startsWith('/api/v1/payments/webhook/stripe')) {
          req.rawBody = buf;
        }
      },
    }),
  );

  // Enable CORS
  const allowedOrigins = process.env.FRONTEND_URL
    ? [
        process.env.FRONTEND_URL,
        'http://localhost:3001',
        'http://localhost:3000',
      ]
    : ['http://localhost:3001', 'http://localhost:3000'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept-Language',
      'stripe-signature',
    ],
  });

  // Parse cookies
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global Cache-Control interceptor (GET → 60s cache, mutations → no-store)
  app.useGlobalInterceptors(new CacheControlInterceptor());

  // NOTE: Do NOT set global prefix here — all controllers already include 'api/v1/' in their @Controller() decorator.
  // app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Kangaroo Japan Backend running on http://localhost:${port}`);
}

void bootstrap();
