import { defineConfig } from '@playwright/test';

const baseURL = process.env.PENNY_E2E_BASE_URL || 'http://127.0.0.1:5174';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL, channel: 'chrome', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: process.env.PENNY_E2E_BASE_URL
    ? undefined
    : { command: 'npx vite --host 127.0.0.1 --port 5174 --strictPort', url: baseURL, timeout: 30_000 },
  reporter: [['list']],
  timeout: 30_000,
});
