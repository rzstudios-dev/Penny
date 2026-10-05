import {
  formatCompactMoney,
  formatMoney,
  type Category,
  type Ledger,
  type Transaction,
} from "../lib/model";
import Icon from "./Icon";

export default function CompactHome({
  ledger,
  transactions,
  onAddCategory,
  onEditCategory,
}: {
  ledger: Ledger;
  transactions: Transaction[];
  onAddCategory: () => void;
  onEditCategory: (category: Category) => void;
}) {
  const money = (amount: number) => formatMoney(amount, ledger.settings);
  const shortMoney = (amount: number) =>
    formatCompactMoney(amount, ledger.settings);
  const summaryAmount = (amount: number) => {
    const short = shortMoney(amount);
    return {
      short,
      exact: money(amount),
      className: short.length > 8 ? "amount-long" : undefined,
    };
  };
  const spent = transactions
    .filter((t) => t.kind === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const budget = ledger.categories.reduce((sum, c) => sum + c.budget, 0);
  const left = budget - spent;
  const spentDisplay = summaryAmount(spent);
  const budgetDisplay = summaryAmount(budget);
  const leftDisplay = summaryAmount(left);
  return (
    <div className="compact-home">
      <section className="budget-overview" aria-label="Budget summary">
        <div>
          <span>Spent</span>
          <strong
            className={spentDisplay.className}
            title={spentDisplay.exact}
            aria-label={spentDisplay.exact}
          >
            {spentDisplay.short}
          </strong>
        </div>
        <div>
          <span>Budget</span>
          <strong
            className={budgetDisplay.className}
            title={budgetDisplay.exact}
            aria-label={budgetDisplay.exact}
          >
            {budgetDisplay.short}
          </strong>
        </div>
        <div>
          <span>{left < 0 ? "Over budget" : "Remaining"}</span>
          <strong
            className={`${left < 0 ? "negative" : "positive"} ${leftDisplay.className || ""}`}
            title={leftDisplay.exact}
            aria-label={leftDisplay.exact}
          >
            {leftDisplay.short}
          </strong>
        </div>
      </section>
      <div className="compact-category-heading">
        <h2>
          Envelopes <span>{ledger.categories.length}</span>
        </h2>
        <button
          className="icon-button add-category-icon"
          aria-label="Create envelope"
          title="Create envelope"
          onClick={onAddCategory}
        >
          <Icon name="plus" size={17} />
        </button>
      </div>
      <div className="compact-category-grid">
        {ledger.categories.map((category) => {
          const used = transactions
            .filter((t) => t.kind === "expense" && t.categoryId === category.id)
            .reduce((sum, t) => sum + t.amount, 0);
          const percent = category.budget ? (used / category.budget) * 100 : 0;
          return (
            <button
              className="compact-category"
              key={category.id}
              onClick={() => onEditCategory(category)}
              aria-label={`Edit ${category.name} budget`}
            >
              <span className={`category-icon color-${category.color}`}>
                <Icon name={category.icon} size={24} />
              </span>
              <div className="compact-category-body">
                <div className="compact-category-label">
                  <strong>{category.name}</strong>
                  <span
                    title={`${money(used)} spent${category.budget ? ` of ${money(category.budget)}` : ""}`}
                  >
                    <b>{shortMoney(used)}</b>
                    <span>
                      {" "}
                      /{" "}
                      {category.budget
                        ? shortMoney(category.budget)
                        : "No budget"}
                    </span>
                  </span>
                </div>
                <div
                  className={`progress-track progress-${category.color} ${percent > 100 ? "over-limit" : ""}`}
                  role="progressbar"
                  aria-label={`${category.name} budget used`}
                  aria-valuenow={Math.min(100, Math.round(percent))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuetext={`${money(used)} spent${category.budget ? ` of ${money(category.budget)}` : ", no budget set"}`}
                >
                  <span
                    style={{
                      transform: `scaleX(${Math.min(1, percent / 100)})`,
                    }}
                  />
                </div>
                <div className="compact-category-meta">
                  <span
                    className={
                      category.budget && used > category.budget
                        ? "negative"
                        : ""
                    }
                    title={
                      category.budget
                        ? money(category.budget - used)
                        : undefined
                    }
                  >
                    {category.budget
                      ? `${shortMoney(category.budget - used)} left`
                      : "Tap to set a monthly budget"}
                  </span>
                  {category.budget > 0 && <span>{Math.round(percent)}%</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {!ledger.categories.length && (
        <div className="empty-state">
          <Icon name="basket" size={32} />
          <h3>Add your first envelope</h3>
          <p>Give your expenses a place in this wallet.</p>
          <button className="button secondary" onClick={onAddCategory}>
            <Icon name="plus" size={18} />
            Add envelope
          </button>
        </div>
      )}
    </div>
  );
}
