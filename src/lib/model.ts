import { z } from "zod";

export const SCALE = 10_000;
export const id = () => crypto.randomUUID();
export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const amountSchema = z
  .number()
  .int()
  .nonnegative()
  .max(1_000_000_000 * SCALE);
const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(40),
  icon: z.string(),
  color: z.enum(["peach", "sage", "lavender", "yellow", "blue", "pink"]),
  budget: amountSchema,
  walletBudgets: z.record(z.string(), amountSchema).default({}),
  walletId: z.string().default(""),
});
const TransactionSchema = z.object({
  id: z.string(),
  kind: z.enum(["expense", "income"]),
  amount: amountSchema.positive(),
  categoryId: z.string(),
  accountId: z.string(),
  note: z.string().max(160),
  details: z.string().max(500).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.string(),
  expenseType: z.enum([
    "needs",
    "wants",
    "savings",
    "subscription",
    "salary",
    "extra",
  ]),
});
const IncomeScheduleSchema = z.object({
  frequency: z.enum(["daily", "monthly", "yearly"]),
  amount: amountSchema.positive(),
  day: z.number().int().min(1).max(31),
  month: z.number().int().min(1).max(12),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const SettingsSchema = z.object({
  currency: z.string().length(3),
  dateOrder: z.enum(["DMY", "MDY", "YMD"]),
  decimals: z.number().int().min(0).max(4),
  decimalMark: z.enum([".", ","]),
  calculator: z.boolean(),
  cloudSync: z.boolean().default(false),
  loginReminder: z.boolean().default(true),
  resetDay: z.number().int().min(1).max(28),
  resetHour: z.number().int().min(0).max(23),
  reminders: z.enum(["never", "daily", "weekly", "monthly"]),
  reminderHour: z.number().int().min(0).max(23),
  premiumReminder: z.boolean(),
  monthlyIncome: amountSchema,
  monthlyIncomeAccount: z.string(),
  dailyIncome: amountSchema.default(0),
  dailyIncomeAccount: z.string().default(""),
  monthlyIncomeStart: z.string().default(""),
  dailyIncomeStart: z.string().default(""),
  tipFrequency: z
    .enum(["never", "daily", "weekly", "monthly"])
    .default("never"),
  tipSeenPeriod: z.string().nullable().default(null),
  selectedWallet: z.string().default(""),
  hasCreatedWallet: z.boolean().default(false),
  savedDescriptions: z.array(z.string().min(1).max(160)).default([]),
  manualResetAt: z.string().nullable(),
  expiryReminderSeen: z.string().nullable(),
});
export const LedgerSchema = z.object({
  schemaVersion: z.literal(1),
  demo: z.boolean(),
  categories: z.array(CategorySchema),
  accounts: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(40),
      openingBalance: amountSchema,
      icon: z.string(),
      currency: z
        .string()
        .regex(/^[A-Z]{3}$/)
        .default("USD"),
      incomeSchedules: z.array(IncomeScheduleSchema).default([]),
    }),
  ),
  transactions: z.array(TransactionSchema).max(100_000),
  settings: SettingsSchema,
});
export type Category = z.infer<typeof CategorySchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type Ledger = z.infer<typeof LedgerSchema>;
export type Settings = Ledger["settings"];
export type Account = Ledger["accounts"][number];
export type IncomeSchedule = Account["incomeSchedules"][number];
export type Entitlement = {
  active: boolean;
  expiresAt: string | null;
  everPremium: boolean;
  lifetime?: boolean;
};

export const defaultSettings: Settings = {
  currency: "USD",
  dateOrder: "DMY",
  decimals: 2,
  decimalMark: ".",
  calculator: false,
  cloudSync: false,
  loginReminder: true,
  resetDay: 1,
  resetHour: 0,
  reminders: "never",
  reminderHour: 19,
  premiumReminder: true,
  monthlyIncome: 0,
  monthlyIncomeAccount: "main",
  dailyIncome: 0,
  dailyIncomeAccount: "",
  monthlyIncomeStart: "",
  dailyIncomeStart: "",
  tipFrequency: "never",
  tipSeenPeriod: null,
  selectedWallet: "",
  hasCreatedWallet: false,
  savedDescriptions: [],
  manualResetAt: null,
  expiryReminderSeen: null,
};
const categoryDefinitions = [
  ["food", "Food & drinks", "fork", "peach", 450],
  ["shopping", "Shopping", "bag", "lavender", 250],
  ["transport", "Transport", "car", "blue", 180],
  ["home", "Home & bills", "house", "sage", 1000],
  ["entertainment", "Entertainment", "game", "pink", 150],
  ["health", "Health & self-care", "heart", "yellow", 120],
  ["groceries", "Groceries", "basket", "sage", 300],
  ["other", "Little extras", "sparkle", "peach", 100],
] as const;
export function emptyLedger(currency = "USD"): Ledger {
  return {
    schemaVersion: 1,
    demo: false,
    categories: [],
    accounts: [],
    transactions: [],
    settings: { ...defaultSettings, currency },
  };
}
export function sampleLedger(): Ledger {
  const ledger = emptyLedger();
  ledger.accounts = [
    {
      id: "main",
      name: "Everyday wallet",
      currency: "USD",
      openingBalance: 0,
      icon: "wallet",
      incomeSchedules: [],
    },
  ];
  ledger.demo = true;
  ledger.categories = categoryDefinitions.map(
    ([categoryId, name, icon, color, budget]) => ({
      id: categoryId,
      name,
      icon,
      color,
      budget: budget * SCALE,
      walletBudgets: {},
      walletId: "main",
    }),
  );
  const today = new Date();
  const current = dateKey(today);
  const first = dateKey(new Date(today.getFullYear(), today.getMonth(), 1));
  ledger.settings.monthlyIncome = 3200 * SCALE;
  const samples: [
    string,
    number,
    string,
    number,
    Transaction["expenseType"],
  ][] = [
    ["home", 850, "A cozy place to call home", 1, "needs"],
    ["food", 28.5, "Lunch with a friend", 2, "wants"],
    ["groceries", 76.25, "The weekly grocery run", 2, "needs"],
    ["transport", 35, "Train pass", 3, "needs"],
    ["shopping", 89, "A little wardrobe refresh", 3, "wants"],
    ["food", 14.8, "Coffee & a croissant", 4, "wants"],
    ["entertainment", 15.99, "Music subscription", 4, "subscription"],
    ["health", 32, "Self-care essentials", 5, "needs"],
    ["food", 18.5, "A lovely little lunch", 5, "needs"],
    ["transport", 12, "Ride home", 5, "needs"],
    ["shopping", 34, "Something for my desk", 5, "wants"],
    ["groceries", 41.3, "Fresh fruit & pantry bits", 5, "needs"],
  ];
  ledger.transactions = samples.map(
    ([categoryId, amount, note, day, expenseType], i) => ({
      id: `sample-${i}`,
      kind: "expense",
      amount: Math.round(amount * SCALE),
      categoryId,
      accountId: "main",
      note,
      date: `${first.slice(0, 8)}${String(Math.min(day, today.getDate())).padStart(2, "0")}`,
      createdAt: new Date(
        today.getTime() - (samples.length - i) * 3600_000,
      ).toISOString(),
      expenseType,
    }),
  );
  ledger.transactions.push(
    {
      id: `salary-${first}`,
      kind: "income",
      amount: 3200 * SCALE,
      categoryId: "",
      accountId: "main",
      note: "Monthly salary",
      date: first,
      createdAt: first + "T08:00:00.000Z",
      expenseType: "salary",
    },
    {
      id: "sample-extra",
      kind: "income",
      amount: 150 * SCALE,
      categoryId: "",
      accountId: "main",
      note: "Freelance project",
      date: current,
      createdAt: new Date(today.getTime() - 12 * 3600_000).toISOString(),
      expenseType: "extra",
    },
  );
  return ledger;
}

export function monthlyPeriod(settings: Settings, anchor = new Date()) {
  let start = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    settings.resetDay,
    settings.resetHour,
  );
  if (anchor < start)
    start = new Date(
      anchor.getFullYear(),
      anchor.getMonth() - 1,
      settings.resetDay,
      settings.resetHour,
    );
  const end = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    settings.resetDay,
    settings.resetHour,
  );
  const manual = settings.manualResetAt
    ? new Date(settings.manualResetAt)
    : null;
  if (manual && manual > start && manual <= anchor) start = manual;
  return { start, end };
}
export function inPeriod(tx: Transaction, start: Date, end: Date) {
  // Selected transaction dates carry noon locally. For a reset on the same date,
  // creation time distinguishes entries created before a manual/hourly reset.
  const [y, m, d] = tx.date.split("-").map(Number);
  let occurred = new Date(y, m - 1, d, 12);
  if (tx.date === dateKey(start) && start.getHours() > 0)
    occurred = new Date(tx.createdAt);
  return occurred >= start && occurred < end;
}
export function addRecurringIncome(ledger: Ledger, now = new Date()): Ledger {
  if (
    !ledger.settings.monthlyIncome ||
    !ledger.accounts.some((a) => a.id === ledger.settings.monthlyIncomeAccount)
  )
    return ledger;
  const anchor = monthlyPeriod(
    { ...ledger.settings, manualResetAt: null },
    now,
  ).start;
  const txId = `recurring-${dateKey(anchor)}`;
  if (
    ledger.settings.monthlyIncomeStart &&
    dateKey(anchor) < ledger.settings.monthlyIncomeStart
  )
    return ledger;
  if (ledger.transactions.some((t) => t.id === txId)) return ledger;
  return {
    ...ledger,
    transactions: [
      ...ledger.transactions,
      {
        id: txId,
        kind: "income",
        amount: ledger.settings.monthlyIncome,
        categoryId: "",
        accountId: ledger.settings.monthlyIncomeAccount,
        note: "Monthly income",
        date: dateKey(anchor),
        createdAt: anchor.toISOString(),
        expenseType: "salary",
      },
    ],
  };
}

export function addDailyIncome(ledger: Ledger, now = new Date()): Ledger {
  const s = ledger.settings,
    today = dateKey(now),
    txId = `daily-income-${today}`;
  if (
    !s.dailyIncome ||
    !ledger.accounts.some((a) => a.id === s.dailyIncomeAccount) ||
    (s.dailyIncomeStart && today < s.dailyIncomeStart) ||
    ledger.transactions.some((t) => t.id === txId)
  )
    return ledger;
  return {
    ...ledger,
    transactions: [
      ...ledger.transactions,
      {
        id: txId,
        kind: "income",
        amount: s.dailyIncome,
        categoryId: "",
        accountId: s.dailyIncomeAccount,
        note: "Daily income",
        date: today,
        createdAt: now.toISOString(),
        expenseType: "salary",
      },
    ],
  };
}

export function applyScheduledIncome(ledger: Ledger, now = new Date()) {
  let next = addDailyIncome(addRecurringIncome(ledger, now), now);
  for (const wallet of next.accounts) {
    for (const schedule of wallet.incomeSchedules || []) {
      const year = now.getFullYear();
      const month =
        schedule.frequency === "yearly" ? schedule.month - 1 : now.getMonth();
      const day = Math.min(
        schedule.day,
        new Date(year, month + 1, 0).getDate(),
      );
      const due =
        schedule.frequency === "daily"
          ? dateKey(now)
          : dateKey(new Date(year, month, day));
      if (dateKey(now) < due || due < schedule.startsOn) continue;
      const txId = `wallet-income-${wallet.id}-${schedule.frequency}-${due}`;
      if (next.transactions.some((tx) => tx.id === txId)) continue;
      next = {
        ...next,
        transactions: [
          ...next.transactions,
          {
            id: txId,
            kind: "income",
            amount: schedule.amount,
            categoryId: "",
            accountId: wallet.id,
            note: `${schedule.frequency[0].toUpperCase()}${schedule.frequency.slice(1)} income`,
            date: due,
            createdAt: now.toISOString(),
            expenseType: "salary",
          },
        ],
      };
    }
  }
  return next;
}
export function walletSettings(ledger: Ledger, walletId?: string): Settings {
  const wallet =
    ledger.accounts.find((a) => a.id === walletId) || ledger.accounts[0];
  return {
    ...ledger.settings,
    currency: wallet?.currency || ledger.settings.currency,
  };
}
export function walletLedger(ledger: Ledger, walletId?: string): Ledger {
  const wallet =
    ledger.accounts.find((a) => a.id === walletId) || ledger.accounts[0];
  return {
    ...ledger,
    settings: walletSettings(ledger, wallet?.id),
    transactions: ledger.transactions.filter((t) => t.accountId === wallet?.id),
    categories: ledger.categories
      .filter(
        (c) =>
          c.walletId === wallet?.id ||
          (!c.walletId && wallet?.id === ledger.accounts[0]?.id),
      )
      .map((c) => ({
        ...c,
        budget:
          c.walletBudgets[wallet?.id || ""] ??
          (wallet?.id === ledger.accounts[0]?.id ? c.budget : 0),
      })),
  };
}

// Upgrade older local ledgers without changing the denomination of saved amounts.
export function parseLedger(raw: unknown): Ledger {
  const value = raw as {
    settings?: { currency?: string };
    accounts?: Record<string, unknown>[];
  };
  const ledger = LedgerSchema.parse({
    ...value,
    accounts: value.accounts?.map((a) => ({
      ...a,
      currency: a.currency || value.settings?.currency || "USD",
    })),
  });
  for (const [frequency, amountKey, accountKey, startKey] of [
    ["monthly", "monthlyIncome", "monthlyIncomeAccount", "monthlyIncomeStart"],
    ["daily", "dailyIncome", "dailyIncomeAccount", "dailyIncomeStart"],
  ] as const) {
    const amount = ledger.settings[amountKey];
    const wallet = ledger.accounts.find(
      (a) => a.id === ledger.settings[accountKey],
    );
    if (
      amount &&
      wallet &&
      !wallet.incomeSchedules.some((s) => s.frequency === frequency)
    ) {
      wallet.incomeSchedules.push({
        frequency,
        amount,
        day: frequency === "monthly" ? ledger.settings.resetDay : 1,
        month: 1,
        startsOn: ledger.settings[startKey] || dateKey(),
      });
    }
    if (wallet) ledger.settings[amountKey] = 0;
  }
  ledger.settings.hasCreatedWallet ||= ledger.accounts.length > 0;
  const categories: Category[] = [];
  const transactions = [...ledger.transactions];
  for (const c of ledger.categories) {
    if (c.walletId) {
      categories.push(c);
      continue;
    }
    const preset = categoryDefinitions.find(
      ([key, name, icon, color]) =>
        key === c.id && name === c.name && icon === c.icon && color === c.color,
    );
    for (const [index, wallet] of ledger.accounts.entries()) {
      const used = transactions.some(
        (t) =>
          t.accountId === wallet.id &&
          t.categoryId === c.id &&
          t.kind === "expense",
      );
      const budget = c.walletBudgets[wallet.id] ?? (index === 0 ? c.budget : 0);
      // Keep customized or used envelopes; retire only untouched old auto-created presets.
      if (!used && !budget && (index > 0 || (preset && c.id !== "food")))
        continue;
      const categoryId = index === 0 ? c.id : `${c.id}::${wallet.id}`;
      categories.push({
        ...c,
        id: categoryId,
        walletId: wallet.id,
        budget,
        walletBudgets: { [wallet.id]: budget },
      });
      if (categoryId !== c.id) {
        for (let i = 0; i < transactions.length; i++) {
          if (
            transactions[i].accountId === wallet.id &&
            transactions[i].categoryId === c.id
          )
            transactions[i] = { ...transactions[i], categoryId };
        }
      }
    }
  }
  const result = { ...ledger, categories, transactions };
  for (const c of categories) {
    if (!ledger.accounts.some((a) => a.id === c.walletId))
      throw new Error("Envelope wallet not found.");
  }
  for (const t of transactions) {
    if (!ledger.accounts.some((a) => a.id === t.accountId))
      throw new Error("Transaction wallet not found.");
    if (
      t.kind === "expense" &&
      !categories.some(
        (c) => c.id === t.categoryId && c.walletId === t.accountId,
      )
    )
      throw new Error("An expense must use an envelope from its own wallet.");
  }
  return result;
}

export function addWallet(ledger: Ledger, wallet: Account): Ledger {
  const first = !ledger.settings.hasCreatedWallet && !ledger.accounts.length;
  return {
    ...ledger,
    accounts: [
      ...ledger.accounts,
      { ...wallet, incomeSchedules: wallet.incomeSchedules || [] },
    ],
    categories: first
      ? [
          ...ledger.categories,
          {
            id: "food",
            name: "Food & drinks",
            icon: "fork",
            color: "peach",
            budget: 0,
            walletBudgets: {},
            walletId: wallet.id,
          },
        ]
      : ledger.categories,
    settings: { ...ledger.settings, hasCreatedWallet: true },
  };
}
export function accountBalance(ledger: Ledger, accountId?: string) {
  return (
    ledger.accounts
      .filter((a) => !accountId || a.id === accountId)
      .reduce((sum, a) => sum + a.openingBalance, 0) +
    ledger.transactions
      .filter((t) => !accountId || t.accountId === accountId)
      .reduce((sum, t) => sum + (t.kind === "income" ? t.amount : -t.amount), 0)
  );
}
export function formatMoney(
  amount: number,
  settings: Settings,
  compact = false,
) {
  const parts = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: settings.currency,
    minimumFractionDigits: compact ? 0 : settings.decimals,
    maximumFractionDigits: compact ? 0 : settings.decimals,
  }).formatToParts(amount / SCALE);
  return parts
    .map((p) =>
      p.type === "decimal"
        ? settings.decimalMark
        : p.type === "group"
          ? settings.decimalMark === ","
            ? "."
            : ","
          : p.value,
    )
    .join("");
}
export function formatCompactMoney(amount: number, settings: Settings) {
  const absolute = Math.abs(amount) / SCALE;
  const units = [
    { value: 1_000_000_000, suffix: "B" },
    { value: 1_000_000, suffix: "M" },
    { value: 1_000, suffix: "K" },
  ];
  const unit = units.find((item) => absolute >= item.value);
  const digits = unit ? Math.min(settings.decimals, 1) : settings.decimals;
  const limit = 1_000 - 10 ** -digits;
  const scaled = unit
    ? Math.sign(amount) * Math.min(absolute / unit.value, limit)
    : amount / SCALE;
  const parts = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: settings.currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: unit ? 0 : settings.decimals,
    maximumFractionDigits: digits,
  }).formatToParts(scaled);
  return (
    parts
      .map((part) =>
        part.type === "decimal"
          ? settings.decimalMark
          : part.type === "group"
            ? settings.decimalMark === ","
              ? "."
              : ","
            : part.value,
      )
      .join("") + (unit?.suffix || "")
  );
}
export function formatDate(date: string, order: Settings["dateOrder"]) {
  const [y, m, d] = date.split("-");
  return order === "DMY"
    ? `${d}/${m}/${y}`
    : order === "MDY"
      ? `${m}/${d}/${y}`
      : `${y}/${m}/${d}`;
}

export function calculate(expression: string, decimalMark = "."): number {
  const normalized = expression
    .replaceAll(decimalMark, ".")
    .replace(/\s/g, "")
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-");
  if (
    !normalized ||
    normalized.length > 120 ||
    /[^\d.+\-*/()]/.test(normalized)
  )
    throw new Error("Enter an amount or a calculation, like 12 + 5.50.");
  const tokens = normalized.match(/(?:\d*\.\d+|\d+\.?\d*)|[()+\-*/]/g) ?? [];
  if (tokens.join("") !== normalized)
    throw new Error("Check your calculation.");
  let position = 0;
  const primary = (): number => {
    const token = tokens[position++];
    if (token === "+") return primary();
    if (token === "-") return -primary();
    if (token === "(") {
      const value = sum();
      if (tokens[position++] !== ")") throw new Error("Close your brackets.");
      return value;
    }
    if (!token || !/^(?:\d*\.\d+|\d+\.?\d*)$/.test(token))
      throw new Error("Check your calculation.");
    return Number(token);
  };
  const product = (): number => {
    let v = primary();
    while (tokens[position] === "*" || tokens[position] === "/") {
      const op = tokens[position++];
      const right = primary();
      if (op === "/" && right === 0)
        throw new Error("You can’t divide by zero.");
      v = op === "*" ? v * right : v / right;
    }
    return v;
  };
  const sum = (): number => {
    let v = product();
    while (tokens[position] === "+" || tokens[position] === "-") {
      const op = tokens[position++];
      const right = product();
      v = op === "+" ? v + right : v - right;
    }
    return v;
  };
  const result = sum();
  if (
    position !== tokens.length ||
    !Number.isFinite(result) ||
    result <= 0 ||
    result > 1e9
  )
    throw new Error(
      "The amount must be greater than 0 and less than one billion.",
    );
  return Math.round((result + Number.EPSILON) * SCALE);
}

export const currencies = [
  "USD",
  "MYR",
  "EUR",
  "GBP",
  "SGD",
  "AUD",
  "CAD",
  "INR",
  "IDR",
  "JPY",
  "KRW",
  "CNY",
  "HKD",
  "THB",
  "PHP",
  "VND",
  "NZD",
  "CHF",
  "AED",
  "SAR",
  "ZAR",
  "BRL",
  "MXN",
  "TRY",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "TWD",
  "BDT",
  "PKR",
  "LKR",
  "NGN",
  "EGP",
  "KES",
];
export const currencyName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" }).of(code) || code;
  } catch {
    return code;
  }
};
