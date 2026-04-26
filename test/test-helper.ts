/**
 * E2E Test Helper
 *
 * Utility functions for E2E tests.
 *
 * Note: Test environment variables are automatically loaded from .env.test
 * via the setup file (test/setup.ts), so you don't need to call setupTestEnv()
 * in individual test files.
 */

/**
 * Generates a unique email for registration tests to avoid "email already exists" conflicts.
 */
export function generateTestEmail(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}@example.com`;
}

/**
 * Default test user credentials factory.
 * Each call returns a new test user with a unique email.
 */
export function createTestUser() {
  return {
    name: 'Test User',
    email: generateTestEmail('e2e'),
    password: 'TestPass123!',
    preferredLanguage: 'zh',
    preferredCurrency: 'CNY',
  };
}

/**
 * Test API base path.
 */
export const API_BASE = '/api/v1';

/**
 * Pauses execution for the given milliseconds.
 * Useful for testing rate limiting or async operations.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
