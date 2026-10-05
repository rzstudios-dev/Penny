import { describe, expect, it } from "vitest";
import { addWallet, emptyLedger, SCALE, type Transaction } from "../../src/lib/model";
import { spendingTips } from "../../src/lib/tips";

const ledger = addWallet(emptyLedger("USD"), {
  id: "cash", name: "Cash", currency: "USD", icon: "wallet", openingBalance: 0, incomeSchedules: [],
});
ledger.categories[0].budget = 100 * SCALE;

function transaction(kind: Transaction["kind"], amount: number): Transaction {
  return {
    id: `${kind}-${amount}`,
    kind,
    amount: amount * SCALE,
    categoryId: kind === "expense" ? "food" : "",
    accountId: "cash",
    note: kind === "expense" ? "Lunch" : "Payday",
    date: "2026-10-05",
    createdAt: "2026-10-05T12:00:00.000Z",
    expenseType: kind === "expense" ? "needs" : "salary",
  };
}

describe("month-specific spending tips", () => {
  it("shows a single fresh tip when the selected month has no entries", () => {
    expect(spendingTips(ledger, [])).toEqual([{ key: "fresh", text: expect.stringContaining("fresh month") }]);
  });
  it("selects at most three distinct insights from the selected month's data", () => {
    const tips = spendingTips(ledger, [transaction("expense", 75), transaction("income", 120)]);
    expect(tips.map((tip) => tip.key)).toEqual(["top", "budget", "income"]);
    expect(tips[0].text).toContain("$75.00");
    expect(tips[1].text).toContain("$25.00");
    expect(tips[2].text).toContain("$45.00");
  });
  it("changes language when spending crosses the limit", () => {
    const tips = spendingTips(ledger, [transaction("expense", 125)]);
    expect(tips[1].text).toContain("past your envelope limits");
    expect(tips).toHaveLength(2);
  });
});
