import { parseLedger, emptyLedger, type Ledger } from "./model";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export type Snapshot = {
  ledger: Ledger;
  revision: number;
  pending: boolean;
  cloudOwner?: string;
};
const key = (owner: string) => `penny:v1:${owner}`;
export async function readSnapshot(owner: string): Promise<Snapshot> {
  const raw = Capacitor.isNativePlatform()
    ? (await Preferences.get({ key: key(owner) })).value
    : localStorage.getItem(key(owner));
  if (!raw) return { ledger: emptyLedger(), revision: 0, pending: false };
  try {
    const parsed = JSON.parse(raw);
    return {
      ledger: removeUnusedStarterWallet(
        removePreviewData(parseLedger(parsed.ledger)),
      ),
      revision: typeof parsed.revision === "number" ? parsed.revision : 0,
      pending: !!parsed.pending,
      cloudOwner: parsed.cloudOwner,
    };
  } catch {
    throw new Error(
      "Your saved data could not be read. It has been preserved. Restore a backup or contact support.",
    );
  }
}

function removeUnusedStarterWallet(ledger: Ledger): Ledger {
  const wallet = ledger.accounts[0];
  if (
    ledger.accounts.length === 1 &&
    wallet.id === "main" &&
    wallet.name === "Everyday account" &&
    !wallet.openingBalance &&
    !ledger.transactions.length &&
    !ledger.settings.monthlyIncome &&
    !wallet.incomeSchedules.length
  )
    return {
      ...ledger,
      accounts: [],
      categories: [],
      settings: { ...ledger.settings, hasCreatedWallet: false },
    };
  return ledger;
}
export async function writeSnapshot(owner: string, snapshot: Snapshot) {
  const value = JSON.stringify(snapshot);
  if (Capacitor.isNativePlatform())
    await Preferences.set({ key: key(owner), value });
  else localStorage.setItem(key(owner), value);
}
export async function removeSnapshot(owner: string) {
  if (Capacitor.isNativePlatform())
    await Preferences.remove({ key: key(owner) });
  else localStorage.removeItem(key(owner));
}

function removePreviewData(ledger: Ledger): Ledger {
  if (!ledger.demo) return ledger;
  const transactions = ledger.transactions.filter(
    (t) => !t.id.startsWith("sample-") && !t.id.startsWith("salary-"),
  );
  return {
    ...ledger,
    demo: false,
    transactions,
    categories: ledger.categories.map((c) => ({ ...c, budget: 0 })),
    accounts: ledger.accounts.map((a) => ({ ...a, incomeSchedules: [] })),
    settings: { ...ledger.settings, monthlyIncome: 0, cloudSync: false },
  };
}
