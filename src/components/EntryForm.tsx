import Select from "./Select";
import { useState, type FormEvent } from "react";
import {
  calculate,
  dateKey,
  id,
  SCALE,
  walletSettings,
  walletLedger,
  type Ledger,
  type Transaction,
} from "../lib/model";
import Icon from "./Icon";
import DatePicker from "./DatePicker";
import DescriptionField from "./DescriptionField";
export default function EntryForm({
  ledger,
  initial,
  initialKind = "expense",
  initialCategory,
  onSave,
  onSaveDescription,
  onRemoveDescription,
  onDelete,
}: {
  ledger: Ledger;
  initial?: Transaction;
  initialKind?: Transaction["kind"];
  initialCategory?: string;
  onSave: (tx: Transaction) => void;
  onSaveDescription: (text: string) => void;
  onRemoveDescription: (text: string) => void;
  onDelete?: () => void;
}) {
  const [kind, setKind] = useState(initial?.kind || initialKind),
    [amount, setAmount] = useState(
      initial
        ? String(initial.amount / SCALE).replace(
            ".",
            ledger.settings.decimalMark,
          )
        : "",
    ),
    [category, setCategory] = useState(
      initial?.categoryId || initialCategory || ledger.categories[0]?.id || "",
    ),
    [wallet, setWallet] = useState(
      initial?.accountId ||
        ledger.accounts.find((a) => a.id === ledger.settings.selectedWallet)
          ?.id ||
        ledger.accounts[0]?.id ||
        "",
    ),
    [description, setDescription] = useState(initial?.note || ""),
    [details, setDetails] = useState(initial?.details || ""),
    [saveTitle, setSaveTitle] = useState(false),
    [date, setDate] = useState(initial?.date || dateKey()),
    [error, setError] = useState("");
  let computed = "";
  const envelopes = walletLedger(ledger, wallet).categories;
  const selectedEnvelope = envelopes.some((c) => c.id === category)
    ? category
    : envelopes[0]?.id || "";
  if (ledger.settings.calculator) {
    try {
      computed = (calculate(amount, ledger.settings.decimalMark) / SCALE)
        .toFixed(ledger.settings.decimals)
        .replace(".", ledger.settings.decimalMark);
    } catch {
      /* Wait for a complete expression. */
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (
        !ledger.settings.calculator &&
        !new RegExp(`^\\d+(?:\\${ledger.settings.decimalMark}\\d{0,4})?$`).test(
          amount.trim(),
        )
      )
        throw new Error(
          "Enter an amount. Enable the calculator in Profile for calculations.",
        );
      if (kind === "expense" && !selectedEnvelope)
        throw new Error("Add an envelope to this wallet first.");
      if (!wallet || !ledger.accounts.some((a) => a.id === wallet))
        throw new Error("Choose a wallet.");
      if (!description.trim()) throw new Error("Add a title.");
      onSave({
        id: initial?.id || id(),
        kind,
        amount: calculate(amount, ledger.settings.decimalMark),
        categoryId: kind === "income" ? "" : selectedEnvelope,
        accountId: wallet,
        note: description.trim(),
        details: details.trim(),
        date,
        createdAt: initial?.createdAt || new Date().toISOString(),
        expenseType:
          initial?.kind === kind
            ? initial.expenseType
            : kind === "income"
              ? "extra"
              : "needs",
      });
      if (saveTitle) onSaveDescription(description.trim());
    } catch (caught) {
      setError((caught as Error).message);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack entry-form">
      <div className="segmented">
        <button
          type="button"
          className={kind === "expense" ? "selected" : ""}
          onClick={() => setKind("expense")}
        >
          <Icon name="up" size={18} />
          Expense
        </button>
        <button
          type="button"
          className={kind === "income" ? "selected" : ""}
          onClick={() => setKind("income")}
        >
          <Icon name="down" size={18} />
          Income
        </button>
      </div>
      <label className="amount-field">
        <span>Amount · {walletSettings(ledger, wallet).currency}</span>
        <input
          aria-label="Amount"
          autoComplete="off"
          inputMode={ledger.settings.calculator ? "text" : "decimal"}
          placeholder="0.00"
          value={amount}
          maxLength={120}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        {ledger.settings.calculator && (
          <small>
            {computed ? `= ${computed}` : "Enter an amount or calculation"}
          </small>
        )}
      </label>
      <DescriptionField
        value={description}
        onChange={setDescription}
        saved={ledger.settings.savedDescriptions}
        saveForLater={saveTitle}
        onSaveForLater={setSaveTitle}
        onRemove={onRemoveDescription}
      />
      <label className="entry-notes">
        <span className="entry-notes-label">Notes <small>optional</small></span>
        <textarea
          value={details}
          maxLength={500}
          rows={2}
          placeholder="Anything you’d like to remember"
          onChange={(event) => setDetails(event.target.value)}
        />
      </label>
      <div className="form-grid">
        {kind === "expense" && (
          <label>
            Envelope
            <Select
              value={selectedEnvelope}
              onChange={(e) => setCategory(e.target.value)}
            >
              {!envelopes.length && (
                <option value="">Add an envelope first</option>
              )}
              {envelopes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label>
          Wallet
          <Select value={wallet} onChange={(e) => setWallet(e.target.value)}>
            {ledger.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.currency}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <DatePicker
        value={date}
        onChange={setDate}
        order={ledger.settings.dateOrder}
      />
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button type="submit" className="button primary full">
        <Icon name="check" />
        {initial
          ? "Save changes"
          : kind === "expense"
            ? "Add expense"
            : "Add income"}
      </button>
      {initial && onDelete && (
        <button type="button" className="button danger full" onClick={onDelete}>
          <Icon name="trash" />
          Delete transaction
        </button>
      )}
    </form>
  );
}
