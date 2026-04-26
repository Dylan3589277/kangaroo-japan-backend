/**
 * E2E Tests: Authentication Flow (Register → Login → Profile)
 *
 * Covers the first core user flow of the kangaroo-japan application.
 * Requires a running PostgreSQL database and Redis server.
 *
 * Run with: npm run test:e2e
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { AppModule } from '../src/app.module';
import { generateTestEmail, API_BASE } from './test-helper';

describe('Authentication Flow (E2E)', () => {
  let app: INestApplication;

  // Store tokens for use across tests
  let accessToken: string;
  let refreshTokenFromCookie: string;
  let registeredEmail: string;

  const testPassword = 'TestPass123!';

  beforeAll(async () => {
    // Generate a unique email for this test run
    registeredEmail = generateTestEmail('auth');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same middleware and pipes as main.ts
    app.use(json());
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ─────────────────────────────────────────
  // 1. POST /api/v1/auth/register
  // ─────────────────────────────────────────
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API_BASE}/auth/register`)
        .send({
          email: registeredEmail,
          password: testPassword,
          name: 'E2E Test User',
          preferredLanguage: 'zh',
          preferredCurrency: 'CNY',
        })
        .expect(201);

      // Verify response structure
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('tokens');

      // Verify user data
      const user = res.body.data.user;
      expect(user).toHaveProperty('id');
      expect(user.email).toBe(registeredEmail);
      expect(user.name).toBe('E2E Test User');
      expect(user).not.toHaveProperty('passwordHash'); // should be sanitized

      // Verify tokens
      const tokens = res.body.data.tokens;
      expect(tokens).toHaveProperty('access_token');
      expect(tokens).toHaveProperty('expires_in', 900);
      accessToken = tokens.access_token;

      // Verify refresh_token cookie is set (HttpOnly)
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies]).find(
        (c: string) => c.startsWith('refresh_token='),
      );
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/');
      expect(refreshCookie).toContain('SameSite=Strict');

      // Extract refresh token from cookie for later use
      const match = refreshCookie!.match(/refresh_token=([^;]+)/);
      if (match) {
        refreshTokenFromCookie = match[1];
      }
    });

    it('should reject registration with missing fields', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API_BASE}/auth/register`)
        .send({
          email: 'bad@example.com',
          // missing password and name
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    it('should reject duplicate email registration', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API_BASE}/auth/register`)
        .send({
          email: registeredEmail, // same email as before
          password: testPassword,
          name: 'Another User',
        })
        .expect(409);

      expect(res.body).toHaveProperty('error');
    });

    it('should reject weak password (less than 8 chars)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API_BASE}/auth/register`)
        .send({
          email: generateTestEmail('weak'),
          password: '1234567', // 7 chars
          name: 'Weak Password User',
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    it('should reject invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API_BASE}/auth/register`)
        .send({
          email: 'not-an-email',
          password: testPassword,
          name: 'Bad Email User',
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });
  });

  // ─────────────────────────────────────────
  // 2. POST /api/v1/auth/login
  // ─────────────────────────────────────────
  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API_BASE}/auth/login`)
        .send({
          email: registeredEmail,
          password: testPassword,
        })
        .expect(200);

      // Verify response structure
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('tokens');

      // Verify user data
      const user = res.body.data.user;
      expect(user.email).toBe(registeredEmail);
      expect(user).not.toHaveProperty('passwordHash');

      // Verify tokens
      const tokens = res.body.data.tokens;
      expect(tokens).toHaveProperty('access_token');
      expect(tokens).toHaveProperty('expires_in', 900);
      accessToken = tokens.access_token;

      // Verify refresh_token cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies]).find(
        (c: string) => c.startsWith('refresh_token='),
      );
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');

      const match = refreshCookie!.match(/refresh_token=([^;]+)/);
      if (match) {
        refreshTokenFromCookie = match[1];
      }
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API_BASE}/auth/login`)
        .send({
          email: registeredEmail,
          password: 'WrongPassword!',
        })
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API_BASE}/auth/login`)
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        })
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should reject login with missing fields', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API_BASE}/auth/login`)
        .send({
          email: '', // empty email
          password: testPassword,
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });
  });

  // ─────────────────────────────────────────
  // 3. GET /api/v1/auth/me (authenticated)
  // ─────────────────────────────────────────
  describe('GET /api/v1/auth/me', () => {
    it('should return current user profile with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API_BASE}/auth/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user.email).toBe(registeredEmail);
    });

    it('should reject unauthenticated access', async () => {
      await request(app.getHttpServer())
        .get(`${API_BASE}/auth/me`)
        .expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .get(`${API_BASE}/auth/me`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  // ─────────────────────────────────────────
  // 4. POST /api/v1/auth/refresh
  // ─────────────────────────────────────────
  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      // Login again to get a fresh refresh token
      const loginRes = await request(app.getHttpServer())
        .post(`${API_BASE}/auth/login`)
        .send({
          email: registeredEmail,
          password: testPassword,
        });

      const cookies = loginRes.headers['set-cookie'];
      const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies]).find(
        (c: string) => c.startsWith('refresh_token='),
      );
      const currentRefreshToken = refreshCookie?.match(/refresh_token=([^;]+)/)?.[1];

      const res = await request(app.getHttpServer())
        .post(`${API_BASE}/auth/refresh`)
        .send({ refreshToken: currentRefreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('tokens');
      expect(res.body.data.tokens).toHaveProperty('access_token');
      expect(res.body.data.tokens).toHaveProperty('expires_in', 900);
    });

    it('should reject refresh with invalid token', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API_BASE}/auth/refresh`)
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(200); // returns 200 with error payload

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toBeDefined();
    });
  });

  // ─────────────────────────────────────────
  // 5. POST /api/v1/auth/logout
  // ─────────────────────────────────────────
  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API_BASE}/auth/logout`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });

    it('should reject logout without auth', async () => {
      await request(app.getHttpServer())
        .post(`${API_BASE}/auth/logout`)
        .expect(401);
    });
  });
});
