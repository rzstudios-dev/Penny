import { useState, type FormEvent } from "react";
import { accountBalance, dateKey, type Transaction } from "../lib/model";
import {
  calculate,
  currencies,
  currencyName,
  id,
  SCALE,
  type Account,
  type Ledger,
} from "../lib/model";
import Select from "./Select";
import Icon from "./Icon";
import { PinSetup } from "./Security";

export default function WalletForm({
  ledger,
  initial,
  onSave,
  onDelete,
  onAdjustment,
  onboarding = false,
}: {
  ledger: Ledger;
  initial?: Account;
  onSave: (wallet: Account) => void;
  onDelete?: () => void;
  onAdjustment?: (transaction: Transaction) => void;
  onboarding?: boolean;
}) {
  const [name, setName] = useState(initial?.name || ""),
    [currency, setCurrency] = useState(
      initial?.currency || ledger.settings.currency,
    ),
    [amount, setAmount] = useState(
      initial?.openingBalance
        ? String(initial.openingBalance / SCALE).replace(
            ".",
            ledger.settings.decimalMark,
          )
        : "",
    ),
    [error, setError] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const hasHistory = ledger.transactions.some(
    (t) => t.accountId === initial?.id,
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      if (!name.trim()) throw new Error("Give your wallet a name.");
      onSave({
        id: initial?.id || id(),
        name: name.trim(),
        currency,
        icon: initial?.icon || "wallet",
        incomeSchedules: initial?.incomeSchedules || [],
        openingBalance: initial?.openingBalance ?? (
          amount && Number(amount.replace(",", ".")) !== 0
            ? calculate(amount, ledger.settings.decimalMark)
            : 0),
      });
    } catch (caught) {
      setError((caught as Error).message);
    }
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <label>
        Wallet name
        <input
          value={name}
          required
          maxLength={40}
          placeholder="Everyday, cash, savings…"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Wallet currency
        <Select
          value={currency}
          disabled={hasHistory}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c} · {currencyName(c)}
            </option>
          ))}
        </Select>
        {hasHistory && (
          <small>
            Currency stays fixed while this wallet has transactions, so your
            saved amounts keep their meaning.
          </small>
        )}
      </label>
      {!initial && <label>
        Starting balance · {currency}
        <input
          value={amount}
          inputMode="decimal"
          placeholder="0.00"
          onChange={(e) => setAmount(e.target.value)}
        />
        <small>Optional. Your balance before adding your first entry.</small>
      </label>}
      {initial && onAdjustment && <label>
        Set current balance · {currency}
        <input value={currentAmount} inputMode="decimal" placeholder="Enter a new balance" onChange={(event) => setCurrentAmount(event.target.value)} />
        <small>The change appears as an adjustment in Transactions.</small>
        <button type="button" className="button secondary full" onClick={() => {
          try {
            const normalized = currentAmount.trim().replace(ledger.settings.decimalMark, ".");
            if (!/^-?\d+(?:\.\d{0,4})?$/.test(normalized)) throw new Error("Enter a valid balance.");
            const target = Math.round(Number(normalized) * SCALE);
            if (!Number.isSafeInteger(target) || Math.abs(target) > 1_000_000_000 * SCALE) throw new Error("That balance is too large.");
            const difference = target - accountBalance(ledger, initial.id);
            if (!difference) throw new Error("This is already your current balance.");
            onAdjustment({ id: id(), kind: difference > 0 ? "income" : "expense", amount: Math.abs(difference), categoryId: "", accountId: initial.id, note: "Balance adjustment", date: dateKey(), createdAt: new Date().toISOString(), expenseType: "adjustment" });
            setCurrentAmount("");
          } catch (caught) { setError((caught as Error).message); }
        }}>Record balance adjustment</button>
      </label>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="button primary full">
        <Icon name="wallet" />
        {onboarding ? "Create my first wallet" : "Save wallet"}
      </button>
      {initial && onDelete && (
        <>
          <button
            type="button"
            className="button danger full"
            onClick={() => { if (window.confirm(`Delete ${initial.name} and all its transactions and envelopes? This cannot be undone.`)) onDelete(); }}
          >
            Delete wallet
          </button>
        </>
      )}
    </form>
  );
}

export function WalletOnboarding({
  ledger,
  onSave,
}: {
  ledger: Ledger;
  onSave: (wallet: Account) => void;
}) {
  const [step, setStep] = useState(() => {
    try { return localStorage.getItem("penny:onboarding-seen") ? 3 : 0; }
    catch { return 0; }
  });
  const finishIntro = () => {
    try { localStorage.setItem("penny:onboarding-seen", "1"); } catch { /* Device storage may be unavailable. */ }
    setStep(3);
  };
  if (step === 2) return <main className="wallet-onboarding onboarding-guide"><div className="onboarding-guide-top"><span className="onboarding-brand">penny</span><button className="text-button" onClick={finishIntro}>Skip</button></div><div className="onboarding-guide-copy"><span className="eyebrow">A little privacy</span><h1>Keep Penny yours.</h1><p>Set a PIN to lock Penny and protect transaction deletion. On supported phones, you can turn on fingerprint or face unlock later in Profile.</p></div><PinSetup onDone={finishIntro} /><button className="button secondary full" onClick={finishIntro}>Maybe later</button></main>;
  if (step < 2) return (
    <main className="wallet-onboarding onboarding-guide">
      <div className="onboarding-guide-top"><span className="onboarding-brand">penny</span><button className="text-button" onClick={finishIntro}>Skip</button></div>
      <div className="onboarding-guide-art"><span className="onboarding-orbit orbit-one" /><span className="onboarding-orbit orbit-two" /><img src="/assets/penny-bunny-small.png" alt="Penny bunny" /></div>
      <div className="onboarding-guide-copy">
        <span className="eyebrow">{step === 0 ? "A happy little start" : "Make it yours"}</span>
        <h1>{step === 0 ? "Meet Penny, your cozy money corner." : "A place for every little goal."}</h1>
        <p>{step === 0 ? "Track what comes in and goes out, one quick entry at a time." : "Create a wallet, then add envelopes with budgets that refresh each month. Your data stays on this device unless you turn on cloud sync."}</p>
      </div>
      <div className="onboarding-guide-footer"><div className="onboarding-dots" aria-label={`Step ${step + 1} of 3`}><span className={step === 0 ? "active" : ""} /><span className={step === 1 ? "active" : ""} /><span /></div><button className="button primary full" onClick={() => setStep(step + 1)}>{step === 0 ? "Next" : "Next"} <Icon name="arrow" size={18} /></button></div>
    </main>
  );
  return (
    <main className="wallet-onboarding">
      <div className="onboarding-intro">
        <img
          src="/assets/penny-bunny-small.png"
          alt="Penny bunny holding your coins"
        />
        <span className="onboarding-brand">penny</span>
        <h1>A home for your pennies.</h1>
        <p>
          Create your first wallet and choose its currency. No sign-in needed.
        </p>
      </div>
      <WalletForm ledger={ledger} onSave={onSave} onboarding />
      <small className="center">
        Everything stays on this device unless you turn on cloud sync.
      </small>
    </main>
  );
}
