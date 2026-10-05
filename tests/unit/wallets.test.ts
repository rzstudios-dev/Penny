import { describe, expect, it } from "vitest";
import {
  addDailyIncome,
  addWallet,
  applyScheduledIncome,
  emptyLedger,
  parseLedger,
  SCALE,
  walletLedger,
  walletSettings,
} from "../../src/lib/model";
import { guessMapping, previewImport } from "../../src/lib/files";

function fixture() {
  const ledger = emptyLedger();
  ledger.accounts = [
    {
      id: "usd",
      name: "Cash",
      icon: "wallet",
      currency: "USD",
      openingBalance: 0,
    },
    {
      id: "myr",
      name: "Malaysia",
      icon: "wallet",
      currency: "MYR",
      openingBalance: 0,
    },
  ];
  const result = addWallet({ ...ledger, accounts: [] }, ledger.accounts[0]);
  result.accounts.push(ledger.accounts[1]);
  result.categories.push({
    ...result.categories[0],
    id: "food-myr",
    walletId: "myr",
  });
  return result;
}
describe("Wallet currencies and budgets", () => {
  it("starts without an implicit wallet, with calculator and tip popups off", () => {
    const l = emptyLedger();
    expect(l.accounts).toEqual([]);
    expect(l.categories).toEqual([]);
    expect(l.settings.calculator).toBe(false);
    expect(l.settings.tipFrequency).toBe("never");
    expect(l.settings.cloudSync).toBe(false);
  });
  it("upgrades old wallets with their ledger currency", () => {
    const l = fixture();
    const old = {
      ...l,
      categories: [],
      settings: { ...l.settings, currency: "MYR" },
      accounts: [
        { id: "old", name: "Old wallet", icon: "wallet", openingBalance: 0 },
      ],
    };
    expect(parseLedger(old).accounts[0].currency).toBe("MYR");
  });
  it("scopes calculations and budget values to one wallet without combining currencies", () => {
    const l = fixture();
    l.categories[0].walletBudgets = { usd: 20 * SCALE };
    l.categories[1].walletBudgets = { myr: 100 * SCALE };
    l.transactions = [
      {
        id: "one",
        kind: "expense",
        amount: 10 * SCALE,
        accountId: "usd",
        categoryId: "food",
        date: "2026-10-05",
        createdAt: "2026-10-05T12:00:00",
        note: "Lunch",
        expenseType: "needs",
      },
      {
        id: "two",
        kind: "expense",
        amount: 50 * SCALE,
        accountId: "myr",
        categoryId: "food-myr",
        date: "2026-10-05",
        createdAt: "2026-10-05T12:00:00",
        note: "Dinner",
        expenseType: "needs",
      },
    ];
    const scoped = walletLedger(l, "myr");
    expect(scoped.settings.currency).toBe("MYR");
    expect(scoped.transactions.map((t) => t.id)).toEqual(["two"]);
    expect(scoped.categories[0].budget).toBe(100 * SCALE);
    expect(walletSettings(l, "usd").currency).toBe("USD");
  });
  it("uses each imported row’s wallet currency", () => {
    const l = fixture(),
      map = guessMapping(["date", "amount", "wallet", "currency", "envelope"]);
    const result = previewImport(
      [
        {
          date: "2026-10-05",
          amount: "12",
          wallet: "Malaysia",
          currency: "MYR",
          envelope: "Food & drinks",
        },
        { date: "2026-10-05", amount: "5", wallet: "Cash", currency: "MYR" },
      ],
      map,
      l,
      "food",
      "usd",
      "YMD",
      ".",
    );
    expect(result.transactions[0].accountId).toBe("myr");
    expect(result.errors).toHaveLength(1);
  });
  it("creates only Food & drinks for the first wallet and none for later wallets", () => {
    const first = addWallet(emptyLedger(), {
      id: "first",
      name: "First",
      currency: "USD",
      openingBalance: 0,
      icon: "wallet",
    });
    expect(first.categories.map((c) => [c.name, c.walletId])).toEqual([
      ["Food & drinks", "first"],
    ]);
    const second = addWallet(first, {
      id: "second",
      name: "Second",
      currency: "MYR",
      openingBalance: 0,
      icon: "wallet",
    });
    expect(walletLedger(second, "second").categories).toEqual([]);
    const replacement = addWallet(
      { ...second, accounts: [], categories: [] },
      {
        id: "third",
        name: "Third",
        currency: "USD",
        openingBalance: 0,
        icon: "wallet",
      },
    );
    expect(replacement.categories).toEqual([]);
  });
  it("migrates old shared envelopes without losing expenses or customized budgets", () => {
    const l = fixture();
    l.categories = [
      {
        ...l.categories[0],
        walletId: "",
        walletBudgets: { usd: 20 * SCALE, myr: 100 * SCALE },
      },
    ];
    l.transactions = [
      {
        id: "legacy",
        kind: "expense",
        categoryId: "food",
        accountId: "myr",
        amount: SCALE,
        date: "2026-10-05",
        createdAt: "2026-10-05T12:00:00",
        note: "Dinner",
        expenseType: "needs",
      },
    ];
    const migrated = parseLedger(l);
    expect(migrated.transactions[0].categoryId).toBe("food::myr");
    expect(walletLedger(migrated, "myr").categories[0].budget).toBe(
      100 * SCALE,
    );
    expect(migrated.transactions[0].amount).toBe(SCALE);
  });
});

describe("Wallet income schedules", () => {
  it("adds monthly income on the chosen day once and uses the last day of short months", () => {
    const ledger = fixture();
    ledger.accounts[0].incomeSchedules = [{ frequency: "monthly", amount: 200 * SCALE, day: 31, month: 1, startsOn: "2027-01-31" }];
    expect(applyScheduledIncome(ledger, new Date(2027, 0, 30)).transactions).toHaveLength(0);
    const january = applyScheduledIncome(ledger, new Date(2027, 0, 31));
    expect(january.transactions[0]).toMatchObject({ accountId: "usd", amount: 200 * SCALE, date: "2027-01-31" });
    expect(applyScheduledIncome(january, new Date(2027, 0, 31)).transactions).toHaveLength(1);
    const february = applyScheduledIncome(january, new Date(2027, 1, 28));
    expect(february.transactions.map((tx) => tx.date)).toEqual(["2027-01-31", "2027-02-28"]);
    expect(applyScheduledIncome(february, new Date(2027, 2, 1)).transactions).toHaveLength(2);
  });

  it("adds yearly income to its wallet on the selected month and day", () => {
    const ledger = fixture();
    ledger.accounts[1].incomeSchedules = [{ frequency: "yearly", amount: 500 * SCALE, day: 29, month: 2, startsOn: "2027-02-28" }];
    const once = applyScheduledIncome(ledger, new Date(2027, 1, 28));
    expect(once.transactions[0]).toMatchObject({ accountId: "myr", date: "2027-02-28" });
    expect(applyScheduledIncome(once, new Date(2027, 7, 1)).transactions).toHaveLength(1);
    expect(applyScheduledIncome(once, new Date(2028, 1, 29)).transactions.map((tx) => tx.date)).toEqual(["2027-02-28", "2028-02-29"]);
  });

  it("moves older global income schedules into their wallet without duplicating them", () => {
    const ledger = fixture();
    ledger.settings.monthlyIncome = 100 * SCALE;
    ledger.settings.monthlyIncomeAccount = "myr";
    ledger.settings.monthlyIncomeStart = "2027-01-01";
    const parsed = parseLedger(JSON.parse(JSON.stringify(ledger)));
    expect(parsed.settings.monthlyIncome).toBe(0);
    expect(parsed.accounts[1].incomeSchedules).toMatchObject([{ frequency: "monthly", amount: 100 * SCALE }]);
    expect(parseLedger(parsed).accounts[1].incomeSchedules).toHaveLength(1);
  });
});
describe("Daily income", () => {
  it("records once per opened day, never retroactively for missed days", () => {
    let l = fixture();
    l.settings.dailyIncome = 15 * SCALE;
    l.settings.dailyIncomeAccount = "myr";
    l = addDailyIncome(l, new Date(2026, 9, 5));
    expect(
      addDailyIncome(l, new Date(2026, 9, 5, 23)).transactions,
    ).toHaveLength(1);
    const later = addDailyIncome(l, new Date(2026, 9, 9));
    expect(later.transactions).toHaveLength(2);
    expect(later.transactions[1].accountId).toBe("myr");
    expect(later.transactions[1].date).toBe("2026-10-09");
  });
  it("respects a deferred start and does not record income with a missing wallet", () => {
    const l = fixture();
    l.settings.dailyIncome = SCALE;
    l.settings.dailyIncomeAccount = "myr";
    l.settings.dailyIncomeStart = "2026-10-06";
    expect(
      applyScheduledIncome(l, new Date(2026, 9, 5)).transactions,
    ).toHaveLength(0);
    l.accounts = [];
    expect(
      applyScheduledIncome(l, new Date(2026, 9, 8)).transactions,
    ).toHaveLength(0);
  });
});
