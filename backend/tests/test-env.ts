/**
 * Test environment wiring. `loadTestEnv` MUST run before any src/ module is
 * imported (src/config/env validates process.env at import time).
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/mini_social_feed_test?schema=public';

export function loadTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef0123456789';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef0123456789';
  process.env.JWT_ACCESS_TTL = '15m';
  process.env.JWT_REFRESH_TTL = '30d';
  process.env.CORS_ORIGINS = '*';
}
