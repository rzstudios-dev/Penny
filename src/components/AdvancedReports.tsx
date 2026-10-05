import { useMemo, useState } from "react";
import { dateKey, formatMoney, type Ledger } from "../lib/model";
import DatePicker from "./DatePicker";
import { Breakdown } from "./Charts";

export default function AdvancedReports({ ledger }: { ledger: Ledger }) {
  const today = new Date(),
    [from, setFrom] = useState(
      dateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
    ),
    [to, setTo] = useState(dateKey());
  const entries = useMemo(
      () => ledger.transactions.filter((t) => t.date >= from && t.date <= to),
      [ledger.transactions, from, to],
    ),
    expenses = entries.filter((t) => t.kind === "expense"),
    income = entries
      .filter((t) => t.kind === "income")
      .reduce((sum, t) => sum + t.amount, 0),
    spent = expenses.reduce((sum, t) => sum + t.amount, 0);
  const weekdays = Array.from({ length: 7 }, (_, day) => ({
      name: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day],
      amount: expenses
        .filter(
          (t) => (new Date(t.date + "T12:00:00").getDay() + 6) % 7 === day,
        )
        .reduce((sum, t) => sum + t.amount, 0),
    })),
    highest = Math.max(1, ...weekdays.map((d) => d.amount));
  return (
    <>
      <section className="panel custom-report">
        <h2>Your chosen dates</h2>
        <div className="form-grid">
          <DatePicker
            label="From"
            value={from}
            onChange={setFrom}
            order={ledger.settings.dateOrder}
          />
          <DatePicker
            label="To"
            value={to}
            onChange={setTo}
            order={ledger.settings.dateOrder}
          />
        </div>
        {from > to ? (
          <p role="alert" className="form-error">
            Choose an end date after the start date.
          </p>
        ) : (
          <>
            <div className="income-schedules">
              <span>
                Income<strong>{formatMoney(income, ledger.settings)}</strong>
              </span>
              <span>
                Spent<strong>{formatMoney(spent, ledger.settings)}</strong>
              </span>
            </div>
            <Breakdown ledger={ledger} transactions={entries} />
          </>
        )}
      </section>
      <section className="panel weekday-report">
        <h2>Spending by weekday</h2>
        <p className="muted">For your chosen dates</p>
        {weekdays.map((d) => (
          <div className="weekday-row" key={d.name}>
            <span>{d.name}</span>
            <div className="progress-track progress-peach">
              <span style={{ transform: `scaleX(${d.amount / highest})` }} />
            </div>
            <strong>{formatMoney(d.amount, ledger.settings)}</strong>
          </div>
        ))}
        <h3>Largest expenses</h3>
        {[...expenses]
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 3)
          .map((t) => (
            <div className="largest-expense" key={t.id}>
              <span>{t.note}</span>
              <strong>{formatMoney(t.amount, ledger.settings)}</strong>
            </div>
          ))}
        {!expenses.length && (
          <p className="muted">Add expenses to see your patterns.</p>
        )}
      </section>
    </>
  );
}
