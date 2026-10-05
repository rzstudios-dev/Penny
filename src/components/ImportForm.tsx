import Select from "./Select";
import { useMemo, useRef, useState } from "react";
import {
  guessMapping,
  previewImport,
  readImport,
  saveFile,
  type ImportRow,
  type Mapping,
} from "../lib/files";
import {
  dateKey,
  formatMoney,
  parseLedger,
  walletLedger,
  type Ledger,
  type Transaction,
} from "../lib/model";
import Icon from "./Icon";
export default function ImportForm({
  ledger,
  onImport,
  onRestore,
}: {
  ledger: Ledger;
  onImport: (transactions: Transaction[]) => void;
  onRestore: (ledger: Ledger) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    [fileName, setFileName] = useState(""),
    [rows, setRows] = useState<ImportRow[]>([]),
    [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>(guessMapping([])),
    [category, setCategory] = useState(ledger.categories[0]?.id || ""),
    [account, setWallet] = useState(
      ledger.settings.selectedWallet || ledger.accounts[0].id,
    ),
    [order, setOrder] = useState(ledger.settings.dateOrder),
    [mark, setMark] = useState(ledger.settings.decimalMark),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const envelopes = walletLedger(ledger, account).categories;
  const fallback = envelopes.some((c) => c.id === category)
    ? category
    : envelopes[0]?.id || "";
  const preview = useMemo(
    () =>
      mapping.date && mapping.amount
        ? previewImport(rows, mapping, ledger, fallback, account, order, mark)
        : null,
    [rows, mapping, ledger, fallback, account, order, mark],
  );
  async function read(file: File) {
    setBusy(true);
    setError("");
    try {
      if (/\.json$/i.test(file.name)) {
        if (file.size > 20 * 1024 * 1024)
          throw new Error("Choose a backup smaller than 20 MB.");
        const restored = parseLedger(JSON.parse(await file.text()));
        if (
          window.confirm(
            "Restore this full backup? It will replace this ledger’s envelopes, wallets, transactions and settings. Export your current backup first.",
          )
        )
          onRestore(restored);
        return;
      }
      const result = await readImport(file);
      setRows(result.rows);
      setHeaders(result.headers);
      setMapping(guessMapping(result.headers));
      setFileName(file.name);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form-stack">
      <p className="muted">
        Bring your little money history along. Export a CSV or Excel file from
        your other app, then match its columns here.
      </p>
      <input
        ref={input}
        type="file"
        accept=".csv,.tsv,.xlsx,.json"
        className="visually-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void read(file);
        }}
      />
      <button
        className="import-drop"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <Icon name="upload" size={32} />
        <strong>
          {busy ? "Reading your file…" : fileName || "Choose your file"}
        </strong>
        <span>CSV, TSV, Excel (.xlsx), or Penny backup (.json)</span>
        <small>Up to 10 MB · 20,000 transactions</small>
      </button>
      <button
        className="text-button"
        onClick={() => {
          void saveFile(
            "penny-import-template.csv",
            `date,amount,kind,envelope,note,details,currency\n${dateKey()},12.50,expense,${envelopes[0]?.name || "Your envelope"},Lunch,,${ledger.accounts.find((a) => a.id === account)?.currency || ledger.settings.currency}`,
            "text/csv",
          );
        }}
      >
        Download a sample CSV <Icon name="download" size={16} />
      </button>
      {!!rows.length && (
        <>
          <div className="form-grid">
            {Object.entries({
              date: "Date column *",
              amount: "Amount column *",
              category: "Envelope column",
              note: "Title column",
              details: "Optional notes column",
              kind: "Income / expense column",
              account: "Wallet column",
            }).map(([key, label]) => (
              <label key={key}>
                {label}
                <Select
                  value={mapping[key as keyof Mapping]}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [key]: e.target.value }))
                  }
                >
                  <option value="">
                    {["date", "amount"].includes(key)
                      ? "Choose a column"
                      : "Use default"}
                  </option>
                  {headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </Select>
              </label>
            ))}
            <label>
              Unmatched envelope
              <Select
                value={fallback}
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
            <label>
              Default wallet
              <Select
                value={account}
                onChange={(e) => setWallet(e.target.value)}
              >
                {ledger.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              File date order
              <Select
                value={order}
                onChange={(e) => setOrder(e.target.value as typeof order)}
              >
                <option value="DMY">Day / Month / Year</option>
                <option value="MDY">Month / Day / Year</option>
                <option value="YMD">Year / Month / Day</option>
              </Select>
            </label>
            <label>
              File decimal mark
              <Select
                value={mark}
                onChange={(e) => setMark(e.target.value as typeof mark)}
              >
                <option value=".">Dot (12.50)</option>
                <option value=",">Comma (12,50)</option>
              </Select>
            </label>
          </div>
          <small>
            Without a type column, entries are expenses. Unmatched envelopes and
            accounts use your defaults above. Penny doesn’t convert currencies.
            Re-imported Penny IDs are skipped.
          </small>
          {preview && (
            <div className="import-preview">
              <strong>
                {preview.transactions.length} ready · {preview.errors.length}{" "}
                need fixing · {preview.duplicates} duplicates skipped
              </strong>
              {preview.transactions.slice(0, 3).map((t) => (
                <div className="preview-row" key={t.id}>
                  <span>{t.note}</span>
                  <span>
                    {t.kind === "income" ? "+" : "−"}
                    {formatMoney(t.amount, ledger.settings)}
                  </span>
                </div>
              ))}
              {!!preview.errors.length && (
                <div className="form-error" role="alert">
                  {preview.errors.slice(0, 8).map((e) => (
                    <p key={e}>{e}</p>
                  ))}
                  {preview.errors.length > 8 && (
                    <p>
                      And {preview.errors.length - 8} more. Fix your source file
                      and choose it again.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            className="button primary full"
            disabled={!preview?.transactions.length || !!preview?.errors.length}
            onClick={() => {
              if (preview) onImport(preview.transactions);
            }}
          >
            <Icon name="check" />
            Import {preview?.transactions.length || 0} transactions
          </button>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
