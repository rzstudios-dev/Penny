import Papa from "papaparse";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import {
  dateKey,
  formatDate,
  id,
  SCALE,
  type Ledger,
  type Transaction,
} from "./model";
export type ImportRow = Record<string, string>;
export type Mapping = {
  date: string;
  amount: string;
  category: string;
  note: string;
  details: string;
  kind: string;
  account: string;
  expenseType: string;
  transactionId: string;
};
export async function readImport(
  file: File,
): Promise<{ headers: string[]; rows: ImportRow[] }> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Please choose a file smaller than 10 MB.");
  let rows: ImportRow[];
  if (/\.xlsx$/i.test(file.name)) {
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("This workbook has no sheets.");
    if (sheet.rowCount > 20001)
      throw new Error("Import up to 20,000 rows at a time.");
    const stringify = (value: unknown): string => {
      if (value instanceof Date) return dateKey(value);
      if (value && typeof value === "object") return "";
      return String(value ?? "").trim();
    };
    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, index) => {
      headers[index - 1] = stringify(cell.value);
    });
    rows = [];
    sheet.eachRow((row, index) => {
      if (index === 1) return;
      const record: ImportRow = {};
      headers.forEach((header, i) => {
        if (header) record[header] = stringify(row.getCell(i + 1).value);
      });
      rows.push(record);
    });
  } else if (/\.(csv|tsv)$/i.test(file.name)) {
    const parsed = Papa.parse<ImportRow>(await file.text(), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      delimitersToGuess: [",", ";", "\t", "|"],
    });
    if (
      parsed.errors.some(
        (e) => e.type === "Quotes" || e.type === "FieldMismatch",
      )
    )
      throw new Error(
        "Some rows have a different number of columns. Check the CSV quoting and headers.",
      );
    rows = parsed.data;
  } else
    throw new Error(
      "Choose a CSV, TSV or Excel .xlsx file. Save older .xls files as .xlsx first.",
    );
  if (!rows.length || rows.length > 20000)
    throw new Error("Choose a file with 1–20,000 transactions.");
  const headers = Object.keys(rows[0]);
  if (new Set(headers).size !== headers.length || headers.some((h) => !h))
    throw new Error("Each column needs a unique header.");
  return { headers, rows };
}
export function guessMapping(headers: string[]): Mapping {
  const find = (...names: string[]) =>
    headers.find((header) =>
      names.includes(header.toLowerCase().replace(/[_\s]/g, "")),
    ) || "";
  return {
    date: find("date", "transactiondate"),
    amount: find("amount", "value"),
    category: find("envelope", "category"),
    note: find("title", "note", "description", "memo"),
    details: find("details", "notes", "additionalnotes", "optionalnote"),
    kind: find("kind", "type", "transactiontype"),
    account: find("wallet", "account"),
    expenseType: find("expensetype"),
    transactionId: find("id", "transactionid"),
  };
}
function parseDate(value: string, order: string) {
  let y: number, m: number, d: number;
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value))
    [y, m, d] = value.split(/[-/]/).map(Number);
  else {
    const parts = value.split(/[-/.]/).map(Number);
    if (parts.length !== 3)
      throw new Error("Use ISO dates or the selected date order.");
    [y, m, d] =
      order === "DMY"
        ? [parts[2], parts[1], parts[0]]
        : order === "MDY"
          ? [parts[2], parts[0], parts[1]]
          : parts;
  }
  const parsed = new Date(y, m - 1, d);
  if (
    y < 1900 ||
    y > 2200 ||
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  )
    throw new Error("Invalid date.");
  return dateKey(parsed);
}
export function previewImport(
  rows: ImportRow[],
  mapping: Mapping,
  ledger: Ledger,
  fallbackCategory: string,
  accountId: string,
  dateOrder: string,
  decimalMark: string,
) {
  const transactions: Transaction[] = [],
    errors: string[] = [];
  let duplicates = 0;
  const seen = new Set(ledger.transactions.map((t) => t.id));
  rows.forEach((row, index) => {
    try {
      const date = parseDate(row[mapping.date]?.trim() || "", dateOrder);
      const resolvedWallet =
        ledger.accounts.find(
          (a) =>
            a.name.toLowerCase() ===
            (row[mapping.account] || "").toLowerCase().trim(),
        ) || ledger.accounts.find((a) => a.id === accountId);
      if (!resolvedWallet) throw new Error("Choose an existing wallet.");
      const currency = row.currency || row.Currency;
      if (currency && currency.toUpperCase() !== resolvedWallet.currency)
        throw new Error(
          "Currency differs from the selected wallet. Penny does not convert currencies.",
        );
      const raw = (row[mapping.amount] || "").trim();
      const stripped =
        decimalMark === ","
          ? raw.replace(/\./g, "").replace(",", ".")
          : raw.replace(/,/g, "");
      if (!/^[+-]?\d+(\.\d{1,4})?$/.test(stripped))
        throw new Error("Invalid amount. Use up to 4 decimal places.");
      const numeric = Number(stripped),
        amount = Math.round(Math.abs(numeric) * SCALE);
      if (!amount || amount > 1e9 * SCALE)
        throw new Error(
          "Amount must be greater than zero and less than one billion.",
        );
      const type = (row[mapping.kind] || "").toLowerCase().trim();
      if (
        type &&
        !["income", "expense", "credit", "debit", "in", "out"].includes(type)
      )
        throw new Error("Type must be income/expense or credit/debit.");
      const kind = ["income", "credit", "in"].includes(type)
        ? "income"
        : type
          ? "expense"
          : numeric < 0
            ? "expense"
            : "expense";
      const categoryId =
        kind === "income"
          ? ""
          : ledger.categories.find(
              (c) =>
                c.walletId === resolvedWallet.id &&
                c.name.toLowerCase() ===
                  (row[mapping.category] || "").toLowerCase().trim(),
            )?.id || fallbackCategory;
      if (
        kind === "expense" &&
        !ledger.categories.some(
          (c) => c.id === categoryId && c.walletId === resolvedWallet.id,
        )
      )
        throw new Error(
          "Choose an envelope from this wallet before importing expenses.",
        );
      const resolvedAccount = resolvedWallet.id;
      const note = (
        row[mapping.note] ||
        (kind === "income" ? "Imported income" : "Imported expense")
      ).slice(0, 160);
      const details = (row[mapping.details] || "").slice(0, 500);
      const txId = row[mapping.transactionId]?.trim() || id();
      if (seen.has(txId)) {
        duplicates++;
        return;
      }
      seen.add(txId);
      const candidate = row[mapping.expenseType]?.trim();
      const expenseType =
        kind === "income"
          ? candidate === "salary"
            ? "salary"
            : "extra"
          : ["needs", "wants", "savings", "subscription"].includes(candidate)
            ? (candidate as Transaction["expenseType"])
            : "needs";
      transactions.push({
        id: txId,
        date,
        amount,
        categoryId,
        accountId: resolvedAccount,
        note,
        details,
        kind,
        expenseType,
        createdAt: `${date}T12:00:00`,
      });
    } catch (error) {
      errors.push(`Row ${index + 2}: ${(error as Error).message}`);
    }
  });
  return { transactions, errors, duplicates };
}
function safeCell(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
export async function exportTransactions(
  ledger: Ledger,
  selected = ledger.transactions,
) {
  const rows = selected.map((t) => ({
    id: t.id,
    date: t.date,
    display_date: formatDate(t.date, ledger.settings.dateOrder),
    kind: t.kind,
    amount: (t.amount / SCALE).toFixed(4),
    currency:
      ledger.accounts.find((a) => a.id === t.accountId)?.currency ||
      ledger.settings.currency,
    envelope: safeCell(
      ledger.categories.find((c) => c.id === t.categoryId)?.name || "",
    ),
    account: safeCell(
      ledger.accounts.find((a) => a.id === t.accountId)?.name || "",
    ),
    note: safeCell(t.note),
    details: safeCell(t.details || ""),
    expense_type: t.expenseType,
  }));
  await saveFile(
    `penny-transactions-${dateKey()}.csv`,
    "\uFEFF" +
      Papa.unparse(rows.length ? rows : [], {
        columns: [
          "id",
          "date",
          "display_date",
          "kind",
          "amount",
          "currency",
          "envelope",
          "account",
          "note",
          "details",
          "expense_type",
        ],
      }),
    "text/csv;charset=utf-8",
  );
}
export async function exportFullBackup(ledger: Ledger) {
  await saveFile(
    `penny-full-backup-${dateKey()}.json`,
    JSON.stringify(ledger, null, 2),
    "application/json",
  );
}
export async function saveFile(filename: string, data: string, mime: string) {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: "Your Penny backup", url: uri });
  } else {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
