/**
 * E2E Test Setup
 *
 * This file is loaded by Jest before any test suite runs (via setupFiles).
 * It loads test environment variables from .env.test.
 */
import { resolve } from 'path';
import { config } from 'dotenv';

// Load .env.test to override environment variables for E2E tests
const envPath = resolve(__dirname, '.env.test');
const result = config({ path: envPath });

if (result.error) {
  console.warn(`[E2E Setup] Could not load .env.test from ${envPath}:`, result.error.message);
} else {
  console.log(`[E2E Setup] Loaded test environment from ${envPath}`);
}
