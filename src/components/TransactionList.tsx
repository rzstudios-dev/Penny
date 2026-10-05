import {
  formatDate,
  formatMoney,
  walletSettings,
  type Ledger,
  type Transaction,
} from "../lib/model";
import Icon from "./Icon";
export default function TransactionList({
  ledger,
  transactions,
  onEdit,
  compact = false,
}: {
  ledger: Ledger;
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  compact?: boolean;
}) {
  if (!transactions.length)
    return (
      <div className="empty-state">
        <Icon name="leaf" size={36} />
        <h3>A fresh little start</h3>
        <p>Your transactions will appear here. Tap the plus to add one.</p>
      </div>
    );
  return (
    <div className={`transaction-list ${compact ? "compact" : ""}`}>
      {transactions.map((tx) => {
        const category = ledger.categories.find((c) => c.id === tx.categoryId),
          account = ledger.accounts.find((a) => a.id === tx.accountId);
        return (
          <button
            className="transaction-row"
            key={tx.id}
            onClick={() => onEdit(tx)}
          >
            <span
              className={`category-icon color-${tx.kind === "income" ? "sage" : category?.color || "peach"}`}
            >
              <Icon
                name={
                  tx.kind === "income" ? "down" : category?.icon || "sparkle"
                }
                size={compact ? 20 : 24}
              />
            </span>
            <span className="transaction-copy">
              <strong>{tx.note}</strong>
              {tx.details && <small className="transaction-note">{tx.details}</small>}
              <small>
                {compact
                  ? category?.name || "Income"
                  : `${category?.name || "Income"} · ${account?.name || "Account"}`}
              </small>
            </span>
            <span
              className={`transaction-amount ${tx.kind === "income" ? "positive" : ""}`}
            >
              <strong>
                {tx.kind === "income" ? "+" : "−"}
                {formatMoney(tx.amount, walletSettings(ledger, tx.accountId))}
              </strong>
              <small>{formatDate(tx.date, ledger.settings.dateOrder)}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
