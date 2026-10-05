import { useState } from "react";
import { calculate, dateKey, SCALE, type Account, type IncomeSchedule, type Ledger } from "../lib/model";
import Select from "./Select";
import Icon from "./Icon";

type Frequency = IncomeSchedule["frequency"];
const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Date(2026, index, 1).toLocaleDateString("en", { month: "long" }),
);

export default function IncomeForm({ ledger, wallet, onSave }: {
  ledger: Ledger;
  wallet: Account;
  onSave: (walletId: string, schedules: IncomeSchedule[]) => void;
}) {
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [amount, setAmount] = useState(() => {
    const saved = wallet.incomeSchedules.find((s) => s.frequency === "monthly");
    return saved ? String(saved.amount / SCALE).replace(".", ledger.settings.decimalMark) : "";
  });
  const [day, setDay] = useState(wallet.incomeSchedules.find((s) => s.frequency === "monthly")?.day || 1);
  const [month, setMonth] = useState(wallet.incomeSchedules.find((s) => s.frequency === "yearly")?.month || 1);
  const [error, setError] = useState("");
  const existing = wallet.incomeSchedules.find((s) => s.frequency === frequency);

  function chooseFrequency(next: Frequency) {
    setFrequency(next);
    const saved = wallet.incomeSchedules.find((s) => s.frequency === next);
    setAmount(saved ? String(saved.amount / SCALE).replace(".", ledger.settings.decimalMark) : "");
    setDay(saved?.day || 1);
    setMonth(saved?.month || 1);
    setError("");
  }

  function nextDue(): string {
    const today = new Date();
    const makeDue = (year: number, monthIndex: number) =>
      new Date(year, monthIndex, Math.min(day, new Date(year, monthIndex + 1, 0).getDate()));
    if (frequency === "daily") return dateKey(today);
    if (frequency === "monthly") {
      let due = makeDue(today.getFullYear(), today.getMonth());
      if (dateKey(due) < dateKey(today)) due = makeDue(today.getFullYear(), today.getMonth() + 1);
      return dateKey(due);
    }
    let due = makeDue(today.getFullYear(), month - 1);
    if (dateKey(due) < dateKey(today)) due = makeDue(today.getFullYear() + 1, month - 1);
    return dateKey(due);
  }

  return (
    <form className="form-stack recurring-income-form" onSubmit={(event) => {
      event.preventDefault();
      try {
        const value = calculate(amount, ledger.settings.decimalMark);
        if (value <= 0) throw new Error("Enter an amount above zero.");
        const schedule: IncomeSchedule = {
          frequency,
          amount: value,
          day: frequency === "daily" ? 1 : day,
          month: frequency === "yearly" ? month : 1,
          startsOn: existing && existing.day === (frequency === "daily" ? 1 : day) && existing.month === (frequency === "yearly" ? month : 1)
            ? existing.startsOn
            : nextDue(),
        };
        onSave(wallet.id, [...wallet.incomeSchedules.filter((s) => s.frequency !== frequency), schedule]);
      } catch (caught) { setError((caught as Error).message); }
    }}>
      <div className="recurring-wallet-label"><span className="profile-row-icon"><Icon name="wallet" size={20} /></span><span><strong>{wallet.name}</strong><small>{wallet.currency} wallet</small></span></div>
      <label>Repeat
        <Select aria-label="Repeat" value={frequency} onChange={(event) => chooseFrequency(event.target.value as Frequency)}>
          <option value="monthly">Every month</option>
          <option value="yearly">Every year</option>
          <option value="daily">Every day</option>
        </Select>
      </label>
      <label>Amount · {wallet.currency}
        <input value={amount} inputMode="decimal" placeholder="0.00" onChange={(event) => setAmount(event.target.value)} />
      </label>
      {frequency !== "daily" && <div className="form-grid">
        {frequency === "yearly" && <label>Month
          <Select aria-label="Month of year" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </Select>
        </label>}
        <label>Day
          <Select aria-label="Day of month" value={day} onChange={(event) => setDay(Number(event.target.value))}>
            {Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
          </Select>
        </label>
      </div>}
      <small className="income-schedule-note">Added once when you open Penny on or after the date. Short months use their last day. Missed periods are not backfilled.</small>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="button primary full"><Icon name="check" size={18} /> Save {frequency} income</button>
      {existing && <button type="button" className="button secondary full" onClick={() => onSave(wallet.id, wallet.incomeSchedules.filter((s) => s.frequency !== frequency))}>Stop {frequency} income</button>}
    </form>
  );
}
