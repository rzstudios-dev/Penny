import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByLabel("Wallet name").fill("Everyday");
  await page.getByRole("button", { name: "Create my first wallet" }).click();
  await expect(page.locator(".budget-overview")).toBeVisible();
});

test("clean desktop home and compact phone home render without errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".budget-overview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add transaction", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Sample ledger")).toHaveCount(0);
  await expect(page.locator(".compact-category")).toHaveCount(1);
  await fs.mkdir(".impeccable/review", { recursive: true });
  await page.screenshot({
    path: ".impeccable/review/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".impeccable/review/mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("expense calculator, budget, income and local persistence work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Profile" })
    .click();
  await page
    .getByRole("button", { name: "Display & amount entry", exact: false })
    .click();
  await page.getByRole("switch", { name: "Amount calculator" }).check();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Home", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit Food & drinks budget" }).click();
  await page.getByLabel("Monthly budget").fill("200");
  await page.getByRole("button", { name: "Save envelope" }).click();
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Amount", exact: true })
    .fill("12 + 5.50");
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Calculator lunch");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Food & drinks budget" }),
  ).toContainText("$17.50");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Edit Food & drinks budget" }),
  ).toContainText("$17.50");
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page.getByRole("button", { name: "Income", exact: true }).click();
  await page.getByRole("textbox", { name: "Amount", exact: true }).fill("150");
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Extra income test");
  await page.getByRole("button", { name: "Add income", exact: true }).click();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Transactions" })
    .click();
  await expect(
    page.getByText("Calculator lunch", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Extra income test", { exact: true }),
  ).toBeVisible();
});

test("free category limit, Premium in Profile and cloud sync off by default", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of [
    "Pets",
    "Travel",
    "Shopping",
    "Transport",
    "Home",
    "Health",
    "Groceries",
    "Gifts",
    "Fun",
  ]) {
    await page
      .getByRole("button", { name: "Create envelope", exact: true })
      .click();
    await page.getByLabel("Envelope name").fill(name);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create envelope", exact: true })
      .click();
  }
  await expect(page.locator(".compact-category")).toHaveCount(10);
  await page
    .getByRole("button", { name: "Create envelope", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Room for every goal.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("This preview can’t take payments.", { exact: false }),
  ).toHaveCount(0);
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Profile" })
    .click();
  await expect(
    page.getByRole("button", { name: /Make room for more/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sign-in & cloud sync", exact: false })
    .click();
  await expect(
    page.getByRole("switch", { name: "Cloud sync" }),
  ).not.toBeChecked();
  await page.getByRole("switch", { name: "Cloud sync" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Sign-in is waiting for the publisher’s setup.",
  );
});

test("CSV import preview and export retain income and expenses", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Transactions" })
    .click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const date = new Date().toISOString().slice(0, 10);
  await page.locator("input[type=file]").setInputFiles({
    name: "budget.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      `date,amount,kind,category,note\n${date},25.75,expense,Food & drinks,Imported dinner\n${date},200,income,,Imported freelance`,
    ),
  });
  await expect(
    page.getByText("2 ready · 0 need fixing · 0 duplicates skipped"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Import 2 transactions" }).click();
  await expect(
    page.getByText("Imported dinner", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const contents = await fs.readFile(path!, "utf8");
  expect(contents.split(/\r?\n/)[0]).toContain("envelope");
  expect(contents).toContain("Food & drinks");
  expect(contents).toContain("Imported dinner");
  expect(contents).toContain("Imported freelance");
  expect(contents).toContain("25.7500");
});

test("manual budget reset retains transaction history", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Amount", exact: true }).fill("12");
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Before reset");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page.locator(".sidebar nav").getByRole("button", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Refresh this month’s progress" }).click();
  await page
    .getByRole("button", { name: "Refresh progress", exact: true })
    .click();
  await expect(page.getByText("Your previous progress view cannot be recovered after this refresh.")).toBeVisible();
  await page.getByRole("button", { name: "Yes, refresh progress" }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Overview" })
    .click();
  await expect(page.locator(".budget-overview")).toContainText("$0.00");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Transactions" })
    .click();
  await page.getByRole("button", { name: "Transaction filters" }).click();
  await page.getByRole("combobox", { name: "Date range" }).click();
  await page.getByRole("option", { name: "All time", exact: true }).click();
  await expect(page.getByText("Before reset", { exact: true })).toBeVisible();
});

test("Premium has no trial and requires login before purchasing or restoring", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore Penny Premium", exact: true })
    .click();
  await expect(
    page.getByText("Google Play subscription · No trial · Cancel anytime"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sign in to get Premium", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(
    page.getByText("Your ledger stays on this device.", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Restore purchase", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
});
