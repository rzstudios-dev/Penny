import { test, expect } from "@playwright/test";
import { addWallet, dateKey, emptyLedger, SCALE } from "../../src/lib/model";

function ledgerFixture() {
  let ledger = addWallet(emptyLedger("MYR"), {
    id: "cash",
    name: "Cash",
    currency: "MYR",
    icon: "wallet",
    openingBalance: 0,
  });
  ledger = addWallet(ledger, {
    id: "savings",
    name: "Savings",
    currency: "USD",
    icon: "wallet",
    openingBalance: 0,
  });
  ledger.settings.selectedWallet = "cash";
  ledger.categories[0].walletBudgets = { cash: 300 * SCALE };
  ledger.categories.push({
    id: "travel",
    walletId: "cash",
    name: "Transport",
    color: "blue",
    icon: "car",
    budget: 0,
    walletBudgets: { cash: 150 * SCALE },
  });
  ledger.transactions = [
    {
      id: "lunch",
      accountId: "cash",
      categoryId: "food",
      kind: "expense",
      amount: 45 * SCALE,
      note: "Lunch",
      date: dateKey(),
      createdAt: new Date().toISOString(),
      expenseType: "needs",
    },
    {
      id: "train",
      accountId: "cash",
      categoryId: "travel",
      kind: "expense",
      amount: 20 * SCALE,
      note: "Train pass",
      date: dateKey(),
      createdAt: new Date().toISOString(),
      expenseType: "needs",
    },
  ];
  return ledger;
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (ledger) =>
      localStorage.setItem(
        "penny:v1:guest",
        JSON.stringify({ ledger, revision: 0, pending: false }),
      ),
    ledgerFixture(),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".budget-overview")).toBeVisible();
});

test("wallets keep separate envelopes and a later wallet starts empty", async ({
  page,
}) => {
  await expect(page.locator(".compact-category")).toHaveCount(2);
  await page.getByRole("combobox", { name: "Active wallet" }).click();
  await page.getByRole("option", { name: "Savings · USD" }).click();
  await expect(page.locator(".compact-category")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Add your first envelope" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add envelope", exact: true }).click();
  await page.getByLabel("Envelope name").fill("Holiday");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create envelope", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit Holiday budget" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Active wallet" }).click();
  await page.getByRole("option", { name: "Cash · MYR" }).click();
  await expect(page.locator(".compact-category")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Edit Holiday budget" }),
  ).toHaveCount(0);
});

test("all destinations have aligned headers, legible charts and themed Premium", async ({
  page,
}) => {
  test.setTimeout(60000);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    const mobile = viewport.width < 760;
    const nav = page.locator(mobile ? ".mobile-nav" : ".sidebar nav");
    for (const [name, file] of [
      [mobile ? "Home" : "Overview", "home"],
      ["Transactions", "transactions"],
      ["Reports", "reports"],
      ["Wallets", "wallets"],
      ["Profile", "profile"],
    ]) {
      await nav.getByRole("button", { name, exact: true }).click();
      const topbarColor = await page
        .locator(".topbar")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      const canvasColor = await page
        .locator(".app-shell")
        .evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--canvas")
            .trim(),
        );
      expect(topbarColor).toBe("rgb(255, 248, 239)");
      expect(canvasColor.toLowerCase()).toBe("#fff8ef");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (file === "reports") {
        await expect(page.locator(".donut-wrap svg")).toBeVisible();
        await expect(page.getByText("Your month in a few numbers")).toHaveCount(
          0,
        );
        expect(
          await page
            .locator(".reports-grid")
            .evaluate(
              (el) =>
                getComputedStyle(el).gridTemplateColumns.split(" ").length,
            ),
        ).toBe(mobile ? 1 : 2);
        await expect(page.locator(".chart-legend")).toContainText("Transport");
      }
      await page.screenshot({
        path:
          ".impeccable/review/envelopes-" +
          file +
          (mobile ? "-phone" : "-desktop") +
          ".png",
        fullPage: true,
        animations: "disabled",
      });
    }
    await page
      .getByRole("button", { name: "Explore Penny Premium", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Premium code" }),
    ).toBeVisible();
    await expect(page.getByText("Have a Premium code?")).toHaveCount(0);
    await expect(page.locator(".premium-buy")).toBeVisible();
    expect(
      await page
        .locator(".premium-offer")
        .evaluate((el) => getComputedStyle(el).backgroundImage),
    ).toContain("linear-gradient");
    await page.screenshot({
      path:
        ".impeccable/review/envelopes-premium" +
        (mobile ? "-phone" : "-desktop") +
        ".png",
      fullPage: true,
      animations: "disabled",
    });
  }
});
