import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';

/**
 * Global Cache-Control interceptor.
 *
 * Adds Cache-Control headers to all API responses:
 * - GET requests → public, max-age=60 (1 minute browser cache, 1 minute CDN/SWR)
 * - Non-GET requests → no-store (never cache mutations)
 *
 * Override per-route by setting Cache-Control header explicitly in the controller.
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        // Don't override if controller already set a Cache-Control header
        if (response.headersSent || response.getHeader('Cache-Control')) {
          return;
        }

        if (request.method === 'GET') {
          // Cache GET responses for 60 seconds (browser) + stale-while-revalidate
          response.setHeader(
            'Cache-Control',
            'public, max-age=60, s-maxage=60, stale-while-revalidate=120',
          );
        } else {
          // Never cache mutations
          response.setHeader('Cache-Control', 'no-store');
        }
      }),
    );
  }
}
