import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test("first-open guide is short, skippable, and shown only once", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Meet Penny, your cozy money corner." }),
  ).toBeVisible();
  await page.screenshot({
    path: ".impeccable/review/onboarding-guide.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Next" }).click();
  await expect(
    page.getByRole("heading", { name: "A place for every little goal." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create my wallet" }).click();
  await expect(page.getByLabel("Wallet name")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Wallet name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);
});

async function setup(page: import("@playwright/test").Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByLabel("Wallet name").fill("Cash");
  await page.getByRole("combobox", { name: "Wallet currency" }).click();
  await page.getByRole("option", { name: /^MYR ·/ }).click();
  await page.getByRole("button", { name: "Create my first wallet" }).click();
  await expect(page.locator(".budget-overview")).toBeVisible();
}
test("wallet onboarding, currency and compact search layout", async ({
  page,
}) => {
  await setup(page);
  await expect(page.locator(".budget-overview")).toContainText("RM");
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Wallets", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit Cash wallet" }),
  ).toBeVisible();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Transactions" })
    .click();
  const search = page.getByRole("textbox", { name: "Search transactions" });
  const field = await page.locator(".search-field").boundingBox(),
    input = await search.boundingBox(),
    icon = await page.locator(".search-field > svg").boundingBox();
  expect(field!.height).toBe(44);
  expect(
    Math.abs(icon!.y + icon!.height / 2 - (input!.y + input!.height / 2)),
  ).toBeLessThan(3);
  expect(
    await page
      .locator(".panel")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe("rgb(255, 255, 255)");
  await page.screenshot({
    path: ".impeccable/review/transactions-final.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Transaction filters" }).click();
  await expect(
    page.getByRole("combobox", { name: "Wallet filter" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Reports" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your spending mix" }),
  ).toBeVisible();
  await expect(page.locator(".report-numbers")).toContainText("MYR");
  await expect(
    page.getByRole("heading", { name: "Your chosen dates" }),
  ).toHaveCount(0);
});
test("required reusable titles, calculator off and themed calendar", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Add transaction" }).click();
  await expect(page.getByRole("button", { name: "Insert +" })).toHaveCount(0);
  await expect(page.getByText("Spending type", { exact: true })).toHaveCount(0);
  await expect(page.locator("input[type=date]")).toHaveCount(0);
  const title = page.getByRole("textbox", {
    name: "Title",
    exact: true,
  });
  await expect(title).toHaveAttribute("required", "");
  await title.fill("Morning coffee");
  await expect(
    page.getByRole("button", { name: "Save title for later" }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(350);
  await page.screenshot({
    path: ".impeccable/review/save-title-toggle.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save title for later" }).click();
  await expect(
    page.getByRole("button", { name: "Save after adding" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Morning");
  await expect(
    page.getByRole("button", { name: "Morning coffee", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Morning coffee");
  await page.getByRole("button", { name: "Save title for later" }).click();
  await page
    .getByRole("textbox", { name: "Amount", exact: true })
    .fill("12.50");
  await page.getByRole("button", { name: "Date", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Choose date", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await expect(page.locator(".budget-overview")).toContainText("12.50");
  await page.reload();
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Morning");
  await page
    .getByRole("button", { name: "Morning coffee", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("Morning coffee");
  await page.getByRole("textbox", { name: "Title", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove saved title Morning coffee" })
    .click();
  await expect(
    page.getByRole("button", { name: "Morning coffee", exact: true }),
  ).toHaveCount(0);
});
test("optional notes stay with entries and appear in CSV backups", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByRole("textbox", { name: "Amount", exact: true }).fill("9.50");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Tea");
  await page.getByRole("textbox", { name: /Notes/ }).fill("Met Mia after work");
  await page.getByRole("button", { name: "Add expense" }).click();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Transactions" })
    .click();
  await expect(page.getByText("Met Mia after work")).toBeVisible();
  await page.getByRole("button", { name: /Tea/ }).click();
  await expect(page.getByRole("textbox", { name: /Notes/ })).toHaveValue(
    "Met Mia after work",
  );
  await page.keyboard.press("Escape");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  expect(await fs.readFile((await download.path())!, "utf8")).toContain(
    "Met Mia after work",
  );
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Home" })
    .click();
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByRole("button", { name: "Income", exact: true }).click();
  await page.getByRole("textbox", { name: "Amount", exact: true }).fill("25");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Bonus");
  await page.getByRole("textbox", { name: /Notes/ }).fill("A little thank-you");
  await page.getByRole("button", { name: "Add income" }).click();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Transactions" })
    .click();
  await expect(page.getByText("A little thank-you")).toBeVisible();
});

test("large home amounts remain visible on narrow screens", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page
    .getByRole("textbox", { name: "Amount", exact: true })
    .fill("999999999.99");
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Large amount");
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.locator(".budget-overview")).toContainText("999.9M");
  await expect(page.locator(".budget-overview strong").first()).toHaveAttribute(
    "title",
    /999,999,999\.99$/,
  );
  expect(
    await page
      .locator(".budget-overview strong")
      .evaluateAll((elements) =>
        elements.every(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Reports tips follow the selected month and cycle when there are insights", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Edit Food & drinks budget" }).click();
  await page.getByLabel("Monthly budget").fill("10");
  await page.getByRole("button", { name: "Save envelope" }).click();
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByRole("textbox", { name: "Amount", exact: true }).fill("12");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Lunch");
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByRole("button", { name: "Income", exact: true }).click();
  await page.getByRole("textbox", { name: "Amount", exact: true }).fill("50");
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Payday");
  await page.getByRole("button", { name: "Add income" }).click();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Reports" })
    .click();
  const card = page.getByRole("region", { name: "Monthly spending tips" });
  await expect(card.locator(".reports-tip-slide")).toHaveCount(3);
  await expect(card.locator(".reports-tip-slide").first()).toContainText(
    "Food & drinks",
  );
  await expect(
    page.getByRole("heading", { name: "Your spending mix" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".impeccable/review/reports-tips-compact.png",
    fullPage: true,
  });
  await page.waitForTimeout(6600);
  expect(
    await card
      .locator(".reports-tips-viewport")
      .evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(0);
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Profile" })
    .click();
  await page
    .getByRole("button", { name: "Refresh this month’s progress" })
    .click();
  await page
    .getByRole("button", { name: "Refresh progress", exact: true })
    .click();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Reports" })
    .click();
  await expect(card.locator(".reports-tip-slide").first()).toContainText(
    "Food & drinks",
  );
  await page.getByRole("button", { name: "Previous budget period" }).click();
  await expect(card.locator(".reports-tip-slide")).toHaveCount(1);
  await expect(card).toContainText("A fresh month");
  await page.getByRole("button", { name: "Next budget period" }).click();
  await expect(card.locator(".reports-tip-slide")).toHaveCount(3);
});
test("envelopes show a negative remainder after going over budget", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Edit Food & drinks budget" }).click();
  await page.getByLabel("Monthly budget").fill("10");
  await page.getByRole("button", { name: "Save envelope" }).click();
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByRole("textbox", { name: "Amount", exact: true }).fill("12");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Lunch");
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.locator(".budget-overview .negative")).toContainText("-RM");
  await expect(page.locator(".compact-category-meta .negative")).toContainText(
    "-RM",
  );
});
test("Wallet income is saved once and Profile stays compact", async ({
  page,
}) => {
  await setup(page);
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Profile" })
    .click();
  await expect(page.getByRole("combobox", { name: "Date order" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("switch", { name: "Cloud sync" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Your wallets/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: /Income & budget resets/ }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".profile-menu")
      .getByRole("button", { name: /^Notifications/ }),
  ).toHaveCount(0);
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Wallets" })
    .click();
  await expect(page.locator(".wallet-envelope-count")).toContainText(
    "1 envelope",
  );
  await expect(
    page.getByRole("button", { name: /View 1 envelope/ }),
  ).toHaveCount(0);
  await expect(page.locator(".wallet-cycle")).toHaveCount(0);
  await page.getByRole("button", { name: /Set recurring income/ }).click();
  await page.waitForTimeout(350);
  await page.screenshot({
    path: ".impeccable/review/wallet-income-form.png",
    fullPage: true,
  });
  await page.getByRole("combobox", { name: "Repeat" }).click();
  await page.getByRole("option", { name: "Every day" }).click();
  await page.getByLabel("Amount · MYR").fill("20");
  await page.getByRole("button", { name: "Save daily income" }).click();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Transactions" })
    .click();
  await expect(page.getByText("Daily income", { exact: true })).toHaveCount(1);
  await page.reload();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Transactions" })
    .click();
  await expect(page.getByText("Daily income", { exact: true })).toHaveCount(1);
});

test("a wallet can add monthly and yearly fixed income on chosen dates", async ({
  page,
}) => {
  await setup(page);
  const today = new Date();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Wallets" })
    .click();
  await page.getByRole("button", { name: /Set recurring income/ }).click();
  await page
    .getByRole("combobox", { name: "Day of month", exact: true })
    .click();
  await page
    .getByRole("option", { name: String(today.getDate()), exact: true })
    .click();
  await page.getByLabel("Amount · MYR").fill("120");
  await page.getByRole("button", { name: "Save monthly income" }).click();
  await page.getByRole("button", { name: /1 income schedule/ }).click();
  await page.getByRole("combobox", { name: "Repeat" }).click();
  await page.getByRole("option", { name: "Every year" }).click();
  await page
    .getByRole("combobox", { name: "Month of year", exact: true })
    .click();
  await page
    .getByRole("option", {
      name: today.toLocaleDateString("en", { month: "long" }),
    })
    .click();
  await page
    .getByRole("combobox", { name: "Day of month", exact: true })
    .click();
  await page
    .getByRole("option", { name: String(today.getDate()), exact: true })
    .click();
  await page.getByLabel("Amount · MYR").fill("500");
  await page.getByRole("button", { name: "Save yearly income" }).click();
  await page.screenshot({
    path: ".impeccable/review/wallets-income.png",
    fullPage: true,
  });
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Transactions" })
    .click();
  await expect(page.getByText("Monthly income", { exact: true })).toHaveCount(
    1,
  );
  await expect(page.getByText("Yearly income", { exact: true })).toHaveCount(1);
  await page.reload();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Transactions" })
    .click();
  await expect(page.getByText("Monthly income", { exact: true })).toHaveCount(
    1,
  );
  await expect(page.getByText("Yearly income", { exact: true })).toHaveCount(1);
});
test("daily tips live in Reports and can be read from the bell", async ({
  page,
}) => {
  await setup(page);
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Reports" })
    .click();
  await expect(page.locator(".reports-tips")).toBeVisible();
  await expect(
    page.locator(".reports-tips select, .reports-tips [role=combobox]"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await page.getByRole("button", { name: "Reminder settings" }).click();
  await page.getByRole("combobox", { name: "Tips when opening Penny" }).click();
  await page.getByRole("option", { name: "Daily" }).click();
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "A little Penny tip" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "A little noted ♡" }).click();
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".reports-tips")).toHaveCount(0);
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(
    page.getByRole("region", { name: "Your notifications" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reminder settings" }).click();
  await expect(
    page.getByRole("button", { name: "Save reminder preferences" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to previous page" }).click();
  await expect(page.locator(".budget-overview")).toBeVisible();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Reports" })
    .click();
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await page.getByRole("button", { name: "Reminder settings" }).click();
  await page.getByRole("button", { name: "Back to previous page" }).click();
  await expect(page.locator(".reports-tips")).toBeVisible();
});
test("icon choices expand with a faded Premium preview; terms open a page", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Edit Food & drinks budget" }).click();
  await expect(page.locator(".icon-picker > button")).toHaveCount(8);
  await expect(page.locator(".icon-preview-art > svg")).toHaveCount(4);
  await page.getByRole("button", { name: "See more" }).click();
  await expect(page.locator(".icon-picker > button")).toHaveCount(16);
  await page.getByRole("button", { name: "Show less" }).click();
  await expect(page.locator(".icon-picker > button")).toHaveCount(8);
  await page
    .getByRole("button", { name: "Unlock 24 more icons with Premium" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Room for every goal." }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Profile" })
    .click();
  await page.getByRole("button", { name: /About & policies/ }).click();
  await page.getByRole("button", { name: /Terms & conditions/ }).click();
  await expect(
    page.getByRole("heading", { name: "Terms & conditions", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/#terms$/);
});

test("public legal screens link to the published Penny pages", async ({ page }) => {
  const pages = [
    ["privacy", "View published privacy policy", "privacy-policy"],
    ["terms", "View published terms", "terms-conditions"],
    ["delete", "View published deletion page", "account-deletion"],
  ] as const;
  for (const [route, label, slug] of pages) {
    await page.goto(`/?page=${route}`);
    await expect(page.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      `https://sites.google.com/view/penny-rzstudios/${slug}`,
    );
  }
});

test("Excel imports retain wallet currency and expense amounts", async ({
  page,
}) => {
  await setup(page);
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.default.Workbook();
  const sheet = workbook.addWorksheet("Expenses");
  sheet.addRow([
    "date",
    "amount",
    "kind",
    "category",
    "wallet",
    "currency",
    "note",
  ]);
  sheet.addRow([
    new Date().toISOString().slice(0, 10),
    16.75,
    "expense",
    "Food & drinks",
    "Cash",
    "MYR",
    "Excel lunch",
  ]);
  sheet.addConditionalFormatting({
    ref: "B2",
    rules: [
      {
        type: "dataBar",
        cfvo: [{ type: "min" }, { type: "max" }],
        color: { argb: "FFB95943" },
      },
    ],
  });
  const bytes = await workbook.xlsx.writeBuffer();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Transactions" })
    .click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "expenses.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(bytes),
  });
  await expect(
    page.getByText("1 ready · 0 need fixing · 0 duplicates skipped"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import 1 transactions", exact: true })
    .click();
  await expect(page.getByText("Excel lunch", { exact: true })).toBeVisible();
  await expect(page.locator(".transaction-amount")).toContainText("MYR");
  await expect(page.locator(".transaction-amount")).toContainText("16.75");
});

test("home-only floating action, compact Profile and signed-in code entry", async ({
  page,
}) => {
  await setup(page);
  const logo = page.locator(".mobile-brand .brand-mark img");
  await expect(logo).toBeVisible();
  expect(
    await logo.evaluate((el) => (el as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  expect((await logo.boundingBox())!.width).toBe(64);
  await expect(page.locator(".mobile-fab")).toHaveCount(1);
  await page.screenshot({
    path: ".impeccable/review/home-code-update.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Edit Food & drinks budget" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: ".impeccable/review/icons-code-update.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  for (const name of ["Transactions", "Reports", "Wallets", "Profile"]) {
    await page
      .locator(".mobile-nav")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(page.locator(".mobile-fab")).toHaveCount(0);
  }
  const rows = page.locator(".profile-menu-compact .settings-action");
  expect((await rows.first().boundingBox())!.height).toBeGreaterThanOrEqual(56);
  await page.screenshot({
    path: ".impeccable/review/profile-code-update.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Backups & imports" }).click();
  await expect(
    page.getByRole("button", { name: /Export transactions as CSV/ }),
  ).toBeVisible();
  await expect(page.getByRole("switch", { name: "Cloud sync" })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to profile" }).click();
  await page.getByRole("button", { name: "Delete account & data" }).click();
  await expect(
    page.getByRole("button", { name: "Delete all device data" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explore Penny Premium", exact: true })
    .click();
  await expect(page.locator(".premium-plan")).toHaveCount(0);
  await expect(page.locator(".mobile-fab")).toHaveCount(0);
  await page
    .getByLabel("Premium code", { exact: true })
    .fill("test-promotion-code");
  await page.screenshot({
    path: ".impeccable/review/premium-code-update.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Sign in to redeem", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: ".impeccable/review/premium-code-desktop.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
