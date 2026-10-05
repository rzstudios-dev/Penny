import { describe, expect, it } from "vitest";
import {
  calculate,
  SCALE,
  defaultSettings,
  formatMoney,
  monthlyPeriod,
  addRecurringIncome,
  emptyLedger,
  addWallet,
  inPeriod,
} from "../../src/lib/model";
import { guessMapping, previewImport } from "../../src/lib/files";
describe("Amount entry", () => {
  it("honors arithmetic precedence and brackets without eval", () => {
    expect(calculate("12 + 5.50 * 2")).toBe(23 * SCALE);
    expect(calculate("(12 + 5.50) × 2")).toBe(35 * SCALE);
    expect(calculate("12,5 + 3,25", ",")).toBe(15.75 * SCALE);
  });
  it("uses fixed point units for fractional amounts", () => {
    expect(calculate("0.1 + 0.2")).toBe(3000);
    expect(calculate("0.0001")).toBe(1);
  });
  it.each([
    "alert(1)",
    "12..5",
    "5 / 0",
    "(4 + 3",
    "0",
    "-5",
    "1e12",
    "2 ** 3",
    "1000000001",
  ])("rejects unsafe or invalid amounts %s", (value) =>
    expect(() => calculate(value)).toThrow(),
  );
  it("formats chosen denomination and separator", () => {
    expect(
      formatMoney(1234.5 * SCALE, {
        ...defaultSettings,
        currency: "EUR",
        decimalMark: ",",
        decimals: 2,
      }),
    ).toBe("€1.234,50");
    expect(
      formatMoney(1234.5 * SCALE, {
        ...defaultSettings,
        currency: "JPY",
        decimals: 0,
      }),
    ).toBe("¥1,235");
  });
});
describe("Budget periods and salary", () => {
  it("uses configured local reset day/hour across year boundaries", () => {
    const p = monthlyPeriod(
      { ...defaultSettings, resetDay: 15, resetHour: 9 },
      new Date(2026, 0, 15, 8),
    );
    expect(p.start).toEqual(new Date(2025, 11, 15, 9));
    expect(p.end).toEqual(new Date(2026, 0, 15, 9));
  });
  it("starts a new manual window without changing the next automatic reset", () => {
    const settings = {
      ...defaultSettings,
      manualResetAt: new Date(2026, 9, 5, 15).toISOString(),
    };
    const p = monthlyPeriod(settings, new Date(2026, 9, 5, 16));
    expect(p.start.getDate()).toBe(5);
    expect(p.end).toEqual(new Date(2026, 10, 1));
  });
  it("records recurring income exactly once and manual reset does not add more", () => {
    const l = fixtureLedger();
    l.settings.monthlyIncome = 3000 * SCALE;
    const once = addRecurringIncome(l, new Date(2026, 9, 5));
    expect(
      addRecurringIncome(once, new Date(2026, 9, 10)).transactions,
    ).toHaveLength(1);
    once.settings.manualResetAt = new Date(2026, 9, 10).toISOString();
    expect(
      addRecurringIncome(once, new Date(2026, 9, 11)).transactions,
    ).toHaveLength(1);
    expect(
      addRecurringIncome(once, new Date(2026, 10, 2)).transactions,
    ).toHaveLength(2);
  });
  it("preserves earlier transactions but excludes them from manual progress", () => {
    const l = fixtureLedger();
    l.settings.monthlyIncome = SCALE;
    const tx = addRecurringIncome(l, new Date(2026, 9, 5)).transactions[0];
    expect(inPeriod(tx, new Date(2026, 9, 5, 15), new Date(2026, 10, 1))).toBe(
      false,
    );
  });
});
describe("Imports", () => {
  it("keeps a transaction title and optional notes in separate columns", () => {
    const ledger = fixtureLedger();
    const mapping = guessMapping(["Date", "Amount", "Title", "Notes"]);
    const result = previewImport(
      [{ Date: "2026-10-05", Amount: "12.50", Title: "Coffee", Notes: "With a friend" }],
      mapping,
      ledger,
      "food",
      "main",
      "YMD",
      ".",
    );
    expect(result.errors).toEqual([]);
    expect(result.transactions[0]).toMatchObject({ note: "Coffee", details: "With a friend" });
  });
  it("maps columns and handles localized decimals and dates", () => {
    const ledger = fixtureLedger("MYR");
    const headers = ["Date", "Amount", "Type", "Description"];
    const preview = previewImport(
      [
        {
          Date: "05/10/2026",
          Amount: "12,50",
          Type: "expense",
          Description: "Lunch",
        },
      ],
      guessMapping(headers),
      ledger,
      "food",
      "main",
      "DMY",
      ",",
    );
    expect(preview.errors).toEqual([]);
    expect(preview.transactions[0].amount).toBe(125000);
    expect(preview.transactions[0].date).toBe("2026-10-05");
  });
  it("rejects invalid dates and mismatched currency without partial import", () => {
    const ledger = fixtureLedger();
    const mapping = guessMapping(["date", "amount"]);
    const result = previewImport(
      [
        { date: "31/02/2026", amount: "10" },
        { date: "2026-10-05", amount: "12", currency: "MYR" },
      ],
      mapping,
      ledger,
      "food",
      "main",
      "DMY",
      ".",
    );
    expect(result.errors).toHaveLength(2);
    expect(result.transactions).toHaveLength(0);
  });
  it("skips existing exported IDs on restore", () => {
    const ledger = fixtureLedger();
    ledger.settings.monthlyIncome = 100 * SCALE;
    const withSalary = addRecurringIncome(ledger, new Date(2026, 9, 5));
    const mapping = guessMapping(["id", "date", "amount", "kind"]);
    const result = previewImport(
      [
        {
          id: withSalary.transactions[0].id,
          date: "2026-10-01",
          amount: "100",
          kind: "income",
        },
      ],
      mapping,
      withSalary,
      "food",
      "main",
      "YMD",
      ".",
    );
    expect(result.duplicates).toBe(1);
    expect(result.transactions).toHaveLength(0);
  });
});

function fixtureLedger(currency = "USD") {
  const ledger = emptyLedger(currency);
  ledger.accounts = [
    {
      id: "main",
      name: "Everyday wallet",
      icon: "wallet",
      openingBalance: 0,
      currency,
    },
  ];
  return addWallet({ ...ledger, accounts: [] }, ledger.accounts[0]);
}
