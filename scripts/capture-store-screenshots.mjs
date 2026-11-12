import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const baseURL = process.env.PENNY_CAPTURE_URL || 'http://127.0.0.1:5174';
const SCALE = 10_000;
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = (number) => `${year}-${month}-${String(Math.min(number, now.getDate())).padStart(2, '0')}`;
const createdAt = now.toISOString();
const expense = (id, categoryId, amount, title, date) => ({
  id, kind: 'expense', amount: Math.round(amount * SCALE), categoryId,
  accountId: 'everyday', note: title, date: day(date), createdAt, expenseType: 'needs',
});
const ledger = {
  schemaVersion: 1,
  demo: false,
  accounts: [{ id: 'everyday', name: 'Everyday', openingBalance: 0, icon: 'wallet', currency: 'USD', incomeSchedules: [] }],
  categories: [
    { id: 'food', name: 'Food & drinks', icon: 'fork', color: 'peach', budget: 450 * SCALE, walletBudgets: {}, walletId: 'everyday' },
    { id: 'transport', name: 'Transport', icon: 'car', color: 'blue', budget: 180 * SCALE, walletBudgets: {}, walletId: 'everyday' },
    { id: 'shopping', name: 'Shopping', icon: 'bag', color: 'lavender', budget: 150 * SCALE, walletBudgets: {}, walletId: 'everyday' },
  ],
  transactions: [
    { id: 'income', kind: 'income', amount: 3200 * SCALE, categoryId: '', accountId: 'everyday', note: 'Monthly income', date: day(1), createdAt, expenseType: 'salary' },
    expense('lunch', 'food', 86.4, 'Lunch and groceries', 3),
    expense('train', 'transport', 42, 'Train pass', 5),
    expense('supplies', 'shopping', 64.9, 'Home supplies', 7),
  ],
  settings: {
    currency: 'USD', dateOrder: 'DMY', decimals: 2, decimalMark: '.', calculator: false,
    cloudSync: false, loginReminder: true, resetDay: 1, resetHour: 0,
    reminders: 'never', reminderHour: 19, premiumReminder: true,
    monthlyIncome: 0, monthlyIncomeAccount: 'everyday', dailyIncome: 0,
    dailyIncomeAccount: '', monthlyIncomeStart: '', dailyIncomeStart: '',
    tipFrequency: 'never', tipSeenPeriod: null, selectedWallet: 'everyday',
    hasCreatedWallet: true, savedDescriptions: [], manualResetAt: null,
    expiryReminderSeen: null,
  },
};

await fs.mkdir('release-assets', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 432, height: 768 },
    deviceScaleFactor: 2.5,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
  });
  const page = await context.newPage();
  await page.addInitScript((data) => {
    localStorage.setItem('penny:onboarding-seen', '1');
    localStorage.setItem('penny:v1:guest', JSON.stringify({ ledger: data, revision: 0, pending: false }));
  }, ledger);
  await page.goto(baseURL);
  await page.locator('.budget-overview').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const capture = async (name) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: `release-assets/screenshot-${name}.jpg`, type: 'jpeg', quality: 90 });
  };
  await capture('home');
  for (const [name, tab] of [
    ['transactions', 'Transactions'],
    ['reports', 'Reports'],
    ['wallets', 'Wallets'],
  ]) {
    await page.locator('.mobile-nav').getByRole('button', { name: tab }).click();
    if (name === 'reports') {
      await page.getByText('Loading reports...').waitFor({ state: 'hidden', timeout: 15_000 });
    }
    await capture(name);
  }
  await page.locator('.mobile-nav').getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Explore Penny Premium', exact: true }).click();
  await capture('premium');
  await context.close();
} finally {
  await browser.close();
}
console.log('Captured five actual Penny screens at 1080x1920.');
