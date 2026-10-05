import { dateKey, formatMoney, type Ledger, type Settings, type Transaction } from "./model";

export type SpendingTip = { key: string; text: string };
export function spendingTips(ledger: Ledger, transactions: Transaction[]): SpendingTip[] {
  const expenses = transactions.filter((tx) => tx.kind === "expense");
  const income = transactions.filter((tx) => tx.kind === "income").reduce((sum, tx) => sum + tx.amount, 0);
  const spent = expenses.reduce((sum, tx) => sum + tx.amount, 0);
  const money = (amount: number) => formatMoney(amount, ledger.settings);
  if (!expenses.length) return [{
    key: "fresh",
    text: income ? "Income is in. Add an expense when you’re ready to see the pattern." : "A fresh month. Your first entry will start the picture.",
  }];
  const result: SpendingTip[] = [];
  const categoryTotals = new Map<string, number>();
  for (const tx of expenses) categoryTotals.set(tx.categoryId, (categoryTotals.get(tx.categoryId) || 0) + tx.amount);
  const [topId, topAmount] = [...categoryTotals].sort((a, b) => b[1] - a[1])[0];
  const topName = ledger.categories.find((category) => category.id === topId)?.name;
  if (topName) result.push({ key: "top", text: `${topName} is your biggest envelope at ${money(topAmount)}.` });
  const budget = ledger.categories.reduce((sum, category) => sum + category.budget, 0);
  if (budget > 0) result.push({
    key: "budget",
    text: spent > budget
      ? `Spending is ${money(spent - budget)} past your envelope limits.`
      : `${money(budget - spent)} is still open in your envelopes.`,
  });
  if (income > 0) result.push({
    key: "income",
    text: spent > income
      ? `Spending is ${money(spent - income)} above recorded income.`
      : `You kept ${money(income - spent)} of recorded income this month.`,
  });
  if (result.length < 2) result.push({
    key: "entries",
    text: `${expenses.length} expense${expenses.length === 1 ? "" : "s"} logged this month. Nice and clear.`,
  });
  return result.slice(0, 3);
}

export const tips = [
  [
    "A tiny habit, a tidy wallet.",
    "Log a little purchase before you forget it.",
  ],
  [
    "Give every penny a home.",
    "A clear envelope makes your spending easier to spot.",
  ],
  [
    "A little backup goes a long way.",
    "Export a CSV or full backup to keep a copy you control.",
  ],
  [
    "Budgets can grow with you.",
    "Review your envelope limits when your routine changes.",
  ],
  [
    "Small check-ins feel lighter.",
    "Take a moment to look at your remaining budget.",
  ],
  ["Let Penny do the math.", "Use +, −, × and ÷ when entering an amount."],
  [
    "Keep your history cozy.",
    "Reset budget progress without deleting your entries.",
  ],
  [
    "Make room for the extras.",
    "Record gifts and one-off earnings as extra income.",
  ],
  ["Your wallet, your pace.", "Choose reminders that fit your routine."],
  [
    "A clearer money story.",
    "Use a short note to remember what an entry was for.",
  ],
] as const;
export function tipForDate(now = new Date()) {
  const day = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000,
  );
  return tips[day % tips.length];
}
export function tipPeriod(
  frequency: Settings["tipFrequency"],
  now = new Date(),
): string | null {
  if (frequency === "never") return null;
  if (frequency === "monthly") return `monthly-${dateKey(now).slice(0, 7)}`;
  if (frequency === "weekly") {
    const monday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - ((now.getDay() + 6) % 7),
    );
    return `weekly-${dateKey(monday)}`;
  }
  return `daily-${dateKey(now)}`;
}
