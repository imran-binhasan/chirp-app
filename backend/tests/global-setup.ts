import { execSync } from 'node:child_process';
import { loadTestEnv, TEST_DATABASE_URL } from './test-env';

/** Applies all migrations to the test database once before the suite runs. */
export default function globalSetup(): void {
  loadTestEnv();
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
