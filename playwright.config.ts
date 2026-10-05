import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', fullyParallel: false, workers: 1, use: { baseURL: 'http://localhost:5173', channel: 'chrome', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' }, reporter: [['list']], timeout: 30000 });
