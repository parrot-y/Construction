import { defineConfig, devices } from '@playwright/test';

const API_PORT = process.env.E2E_API_PORT || '4199';
const WEB_PORT = process.env.E2E_WEB_PORT || '5180';
const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-390', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @construction/api exec tsx src/index.ts',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: API_PORT,
        HOST: '127.0.0.1',
        DATABASE_URL: process.env.E2E_DATABASE_URL || '',
        JWT_SECRET: process.env.E2E_JWT_SECRET || 'e2e-test-jwt-secret-with-at-least-32-characters!!',
        WEB_ORIGIN: WEB_URL,
        NODE_ENV: 'development',
        // The suite performs dozens of real logins per minute from one IP;
        // the production default (30/min) would 429 mid-run. E2E only.
        LOGIN_RATE_LIMIT_MAX: process.env.E2E_LOGIN_RATE_LIMIT_MAX || '1000',
        INVITATION_ACCEPT_RATE_LIMIT_MAX: process.env.E2E_INVITATION_ACCEPT_RATE_LIMIT_MAX || '1000',
        REGISTER_COMPANY_RATE_LIMIT_MAX: process.env.E2E_REGISTER_COMPANY_RATE_LIMIT_MAX || '1000',
        LOG_LEVEL: 'warn',
        UPLOAD_DIR: process.env.E2E_UPLOAD_DIR || '/tmp/e2e-uploads',
      },
    },
    {
      command: `pnpm --filter @construction/web exec vite --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_API_TARGET: API_URL,
      },
    },
  ],
});
