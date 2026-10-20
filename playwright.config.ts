import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to an isolated, migrated, seeded PostgreSQL database.');
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 120000,
  expect: { timeout: 30000 },
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure', actionTimeout: 30000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run start -- --port 3100', url: 'http://localhost:3100/login', reuseExistingServer: false, timeout: 120000, env: { DATABASE_URL: process.env.TEST_DATABASE_URL, APP_URL: 'http://localhost:3100', VIDEO_STORAGE_DIR: join(tmpdir(), 'lkp-playwright-videos') } }
});
