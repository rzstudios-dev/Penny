import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import {
  dateKey,
  formatMoney,
  inPeriod,
  SCALE,
  type Ledger,
} from "../lib/model";
export const chartColors: Record<string, string> = {
  peach: "#A74A32",
  sage: "#4D6E47",
  lavender: "#705291",
  yellow: "#8B681E",
  blue: "#306D88",
  pink: "#9F4067",
};
export function Breakdown({
  ledger,
  transactions = ledger.transactions,
}: {
  ledger: Ledger;
  transactions?: Ledger["transactions"];
}) {
  const data = ledger.categories
    .map((c) => ({
      name: c.name,
      value: transactions
        .filter((t) => t.kind === "expense" && t.categoryId === c.id)
        .reduce((s, t) => s + t.amount, 0),
      color: chartColors[c.color],
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = data.reduce((s, c) => s + c.value, 0);
  return (
    <>
      <div
        className="donut-wrap"
        role="img"
        aria-label={`Spending breakdown. Total ${formatMoney(total, ledger.settings)}. ${data.map((d) => `${d.name}: ${formatMoney(d.value, ledger.settings)}`).join(". ")}`}
      >
        {total ? (
          <ResponsiveContainer width="100%" height={205}>
            <PieChart>
              <Pie
                data={data}
                innerRadius={67}
                outerRadius={91}
                paddingAngle={4}
                cornerRadius={5}
                dataKey="value"
                stroke="#F7ECE0"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-ring" />
        )}
        <div className="donut-center">
          <small>Total spent</small>
          <strong>{formatMoney(total, ledger.settings)}</strong>
        </div>
      </div>
      <div className="chart-legend">
        {data.map((c) => (
          <div key={c.name}>
            <span>
              <i style={{ background: c.color }} />
              {c.name}
            </span>
            <strong>{Math.round((c.value / total) * 100)}%</strong>
          </div>
        ))}
        {!data.length && (
          <p className="muted center">
            Your spending story starts with your first expense.
          </p>
        )}
      </div>
    </>
  );
}
export function SpendingChart({
  ledger,
  start,
  end,
}: {
  ledger: Ledger;
  start: Date;
  end: Date;
}) {
  const days = Math.min(
    35,
    Math.ceil((end.getTime() - start.getTime()) / 86400000),
  );
  const data = Array.from({ length: days }, (_, index) => {
    const day = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + index,
    );
    const key = dateKey(day);
    return {
      day: day.getDate(),
      amount: ledger.transactions
        .filter(
          (t) =>
            t.kind === "expense" && t.date === key && inPeriod(t, start, end),
        )
        .reduce((s, t) => s + t.amount / SCALE, 0),
    };
  });
  return (
    <div
      className="line-chart"
      role="img"
      aria-label="Daily spending chart. Individual amounts are available in Transactions."
    >
      <ResponsiveContainer width="100%" height={210}>
        <AreaChart
          data={data}
          margin={{ top: 14, right: 8, bottom: 0, left: -22 }}
        >
          <defs>
            <linearGradient id="spending-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D38D74" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#D38D74" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#EEE7DF"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            minTickGap={20}
            tick={{ fill: "#796A63", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#796A63", fontSize: 11 }}
          />
          <Tooltip
            formatter={(v: unknown) => [
              formatMoney(Number(v) * SCALE, ledger.settings),
              "Spent",
            ]}
            contentStyle={{
              backgroundColor: "#F1E2D2",
              color: "#493B36",
              borderRadius: 12,
              border: "1px solid #eee7df",
              fontSize: 13,
            }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#B95943"
            strokeWidth={2.5}
            fill="url(#spending-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function TrendChart({ ledger }: { ledger: Ledger }) {
  const now = new Date();
  const data = Array.from({ length: 6 }, (_, i) => {
    const month = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = dateKey(month).slice(0, 7);
    const tx = ledger.transactions.filter((t) => t.date.startsWith(key));
    return {
      month: month.toLocaleDateString("en", { month: "short" }),
      Income: tx
        .filter((t) => t.kind === "income")
        .reduce((s, t) => s + t.amount / SCALE, 0),
      Expenses: tx
        .filter((t) => t.kind === "expense")
        .reduce((s, t) => s + t.amount / SCALE, 0),
    };
  });
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid vertical={false} stroke="#EEE7DF" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis width={50} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(v: unknown) =>
            formatMoney(Number(v) * SCALE, ledger.settings)
          }
        />
        <Bar dataKey="Income" fill="#92AC83" radius={[5, 5, 0, 0]} />
        <Bar dataKey="Expenses" fill="#E7A389" radius={[5, 5, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
