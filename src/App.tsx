import Select from "./components/Select";
import NotificationCenter from "./components/NotificationCenter";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  lazy,
  Suspense,
  useState,
  type FormEvent,
} from "react";
import { Capacitor } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import {
  accountBalance,
  addWallet,
  applyScheduledIncome,
  walletLedger,
  walletSettings,
  calculate,
  currencies,
  currencyName,
  dateKey,
  emptyLedger,
  formatMoney,
  id,
  inPeriod,
  monthlyPeriod,
  SCALE,
  type Account,
  type Category,
  type Ledger,
  type Transaction,
} from "./lib/model";
import { usePenny } from "./lib/usePenny";
import { deleteCloudAccount, loadCloud, supabase } from "./lib/cloud";
import { clearNotifications } from "./lib/notifications";
import { removeSnapshot } from "./lib/storage";
import { exportTransactions } from "./lib/files";
import Icon from "./components/Icon";
import CompactHome from "./components/CompactHome";
import Modal from "./components/Modal";
import EntryForm from "./components/EntryForm";
import CategoryForm from "./components/CategoryForm";
import ImportForm from "./components/ImportForm";
import AuthForm from "./components/AuthForm";
import Legal from "./components/Legal";
import Premium from "./components/Premium";
import Profile, { type ProfilePage } from "./components/Profile";
import WalletForm, { WalletOnboarding } from "./components/WalletForm";
import IncomeForm from "./components/IncomeForm";
import ReportsTips from "./components/ReportsTips";
import { spendingTips, tipPeriod } from "./lib/tips";
const AdvancedReports = lazy(() => import("./components/AdvancedReports"));
import TransactionList from "./components/TransactionList";
const Breakdown = lazy(() =>
  import("./components/Charts").then((m) => ({ default: m.Breakdown })),
);
const SpendingChart = lazy(() =>
  import("./components/Charts").then((m) => ({ default: m.SpendingChart })),
);
const TrendChart = lazy(() =>
  import("./components/Charts").then((m) => ({ default: m.TrendChart })),
);

type Tab =
  "home" | "transactions" | "reports" | "accounts" | "premium" | "settings";
type Dialog =
  | {
      type: "entry";
      transaction?: Transaction;
      kind?: Transaction["kind"];
      categoryId?: string;
    }
  | { type: "category"; category?: Category }
  | { type: "account"; account?: Account }
  | { type: "income"; accountId: string }
  | { type: "cloud"; remote: import("./lib/storage").Snapshot | null }
  | {
      type:
        | "import"
        | "login"
        | "reset"
        | "delete"
        | "fresh"
        | "expired"
        | "tip";
    }
  | { type: "legal"; page: "privacy" | "terms" | "about" | "delete" };
const navigation: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Overview", icon: "house" },
  { id: "transactions", label: "Transactions", icon: "transactions" },
  { id: "reports", label: "Reports", icon: "report" },
  { id: "accounts", label: "Wallets", icon: "wallet" },
  { id: "settings", label: "Profile", icon: "user" },
];

export default function App() {
  const penny = usePenny();
  const { ledger, user, entitlement, update } = penny;
  const [tab, setTab] = useState<Tab>("home"),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [monthOffset, setMonthOffset] = useState(0);
  const [search, setSearch] = useState(""),
    [kindFilter, setKindFilter] = useState("all"),
    [accountFilter, setAccountFilter] = useState("all"),
    [allTime, setAllTime] = useState(false),
    [pageSize, setPageSize] = useState(50);
  const [toast, setToast] = useState(""),
    [deleteWord, setDeleteWord] = useState(""),
    [busy, setBusy] = useState(false),
    [dialogError, setDialogError] = useState("");
  const close = useCallback(() => {
    setDialog(null);
    setDialogError("");
    setDeleteWord("");
  }, []);
  const message = useCallback((text: string) => setToast(text), []);
  useEffect(() => {
    if (user && dialog?.type === "login") close();
  }, [user, dialog?.type, close]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (
      !ledger ||
      !entitlement.everPremium ||
      entitlement.active ||
      !entitlement.expiresAt ||
      ledger.settings.expiryReminderSeen === entitlement.expiresAt
    )
      return;
    update((l) => ({
      ...l,
      settings: { ...l.settings, expiryReminderSeen: entitlement.expiresAt },
    }));
    setDialog({ type: "expired" });
  }, [entitlement, ledger?.settings.expiryReminderSeen, update]);
  useEffect(() => {
    const handler = (event: Event) => message((event as CustomEvent).detail);
    window.addEventListener("penny-auth-error", handler);
    return () => window.removeEventListener("penny-auth-error", handler);
  }, [message]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    void NativeApp.addListener("backButton", () => {
      if (location.hash) location.hash = "";
      else if (dialog) close();
      else if (tab !== "home") setTab("home");
      else void NativeApp.minimizeApp();
    }).then((h) => {
      remove = () => {
        void h.remove();
      };
    });
    return () => remove?.();
  }, [dialog, tab, close]);
  const [hashPage, setHashPage] = useState(location.hash.slice(1));
  useEffect(() => {
    const change = () => setHashPage(location.hash.slice(1));
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const legalQuery =
    hashPage || new URLSearchParams(location.search).get("page");
  if (["privacy", "terms", "delete", "about"].includes(legalQuery || ""))
    return (
      <main className="public-legal">
        <button
          className="button secondary small legal-back"
          onClick={() => {
            if (hashPage) location.hash = "";
            else location.href = "/";
          }}
        >
          <Icon name="left" size={17} />
          Back to Penny
        </button>
        <a className="brand" href="/">
          <span className="brand-mark">
            <img src="/assets/penny-bunny-small.png" alt="" />
          </span>
          <span>
            penny
          </span>
        </a>
        <h1>
          {legalQuery === "privacy"
            ? "Privacy policy"
            : legalQuery === "terms"
              ? "Terms & conditions"
              : legalQuery === "delete"
                ? "Delete your account"
                : "About Penny"}
        </h1>
        <Legal page={legalQuery as "privacy" | "terms" | "delete" | "about"} />
      </main>
    );
  if (!ledger)
    return (
      <div className="loading-screen">
        <img src="/assets/penny-bunny.png" alt="Penny bunny" />
        <h1>penny</h1>
        <p>{penny.error || "Getting your little corner ready…"}</p>
        {penny.error && (
          <button
            className="button secondary"
            onClick={() => location.reload()}
          >
            Try again
          </button>
        )}
      </div>
    );
  return (
    <PennyView
      {...{
        penny,
        ledger,
        user,
        entitlement,
        update,
        tab,
        setTab,
        dialog,
        setDialog,
        monthOffset,
        setMonthOffset,
        search,
        setSearch,
        kindFilter,
        setKindFilter,
        accountFilter,
        setAccountFilter,
        allTime,
        setAllTime,
        pageSize,
        setPageSize,
        toast,
        close,
        message,
        deleteWord,
        setDeleteWord,
        busy,
        setBusy,
        dialogError,
        setDialogError,
      }}
    />
  );
}

type ViewProps = {
  penny: ReturnType<typeof usePenny>;
  ledger: Ledger;
  user: ReturnType<typeof usePenny>["user"];
  entitlement: ReturnType<typeof usePenny>["entitlement"];
  update: ReturnType<typeof usePenny>["update"];
  tab: Tab;
  setTab: (tab: Tab) => void;
  dialog: Dialog | null;
  setDialog: (d: Dialog | null) => void;
  monthOffset: number;
  setMonthOffset: (n: number) => void;
  search: string;
  setSearch: (s: string) => void;
  kindFilter: string;
  setKindFilter: (s: string) => void;
  accountFilter: string;
  setAccountFilter: (s: string) => void;
  allTime: boolean;
  setAllTime: (s: boolean) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  toast: string;
  close: () => void;
  message: (s: string) => void;
  deleteWord: string;
  setDeleteWord: (s: string) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  dialogError: string;
  setDialogError: (s: string) => void;
};
function PennyView(p: ViewProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false),
    [notificationOrigin, setNotificationOrigin] = useState<{tab: Tab; profilePage?: ProfilePage} | null>(null),
    [tipUnread, setTipUnread] = useState(() => {
      try { return localStorage.getItem("penny:notification-tip-seen") !== dateKey(); }
      catch { return true; }
    }),
    [showFilters, setShowFilters] = useState(false),
    [profilePage, setProfilePage] = useState<ProfilePage>("menu");
  const tipChecked = useRef(false),
    seenTip = useRef<string | null>(null),
    currentProfilePage = useRef<ProfilePage>("menu");
  const {
    penny,
    ledger,
    user,
    entitlement,
    update,
    tab,
    setTab,
    dialog,
    setDialog,
    close,
    message,
  } = p;
  const activeWallet =
    ledger.accounts.find((a) => a.id === ledger.settings.selectedWallet) ||
    ledger.accounts[0];
  const scopedLedger = useMemo(
    () => walletLedger(ledger, activeWallet?.id),
    [ledger, activeWallet?.id],
  );
  const now = new Date(),
    anchor = new Date(
      now.getFullYear(),
      now.getMonth() + p.monthOffset,
      Math.min(now.getDate(), 28),
      now.getHours(),
      now.getMinutes(),
    );
  const period = monthlyPeriod(ledger.settings, anchor),
    money = (value: number, compact = false) =>
      formatMoney(value, scopedLedger.settings, compact);
  const periodTransactions = useMemo(
    () =>
      ledger.transactions.filter(
        (t) =>
          t.accountId === activeWallet?.id &&
          inPeriod(t, period.start, period.end),
      ),
    [
      ledger.transactions,
      activeWallet?.id,
      period.start.getTime(),
      period.end.getTime(),
    ],
  );
  const tipTransactions = useMemo(() => {
    const month = dateKey(period.start).slice(0, 7);
    return ledger.transactions.filter((transaction) =>
      transaction.accountId === activeWallet?.id && transaction.date.startsWith(month),
    );
  }, [ledger.transactions, activeWallet?.id, period.start.getTime()]);
  const reportTips = useMemo(
    () => spendingTips(scopedLedger, tipTransactions),
    [scopedLedger, tipTransactions],
  );
  const spent = periodTransactions
      .filter((t) => t.kind === "expense")
      .reduce((sum, t) => sum + t.amount, 0),
    income = periodTransactions
      .filter((t) => t.kind === "income")
      .reduce((sum, t) => sum + t.amount, 0),
    budget = scopedLedger.categories.reduce((sum, c) => sum + c.budget, 0);
  const sorted = [...ledger.transactions].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
  const filtered = sorted.filter(
    (t) =>
      (p.allTime || inPeriod(t, period.start, period.end)) &&
      (p.kindFilter === "all" || t.kind === p.kindFilter) &&
      (p.accountFilter === "all" || t.accountId === p.accountFilter) &&
      `${t.note} ${ledger.categories.find((c) => c.id === t.categoryId)?.name || ""}`
        .toLowerCase()
        .includes(p.search.toLowerCase()),
  );
  const remaining = budget - spent,
    overBudget = remaining < 0;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | undefined;
    void LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (event) => {
        if (event.notification.id === 1003) setDialog({ type: "login" });
        else if (event.notification.id === 1002) setTab("premium");
        else setTab("home");
      },
    ).then((h) => {
      handle = h;
    });
    return () => {
      void handle?.remove();
    };
  }, []);
  useEffect(() => {
    const check = () => {
      if (!ledger.accounts.length || dialog || location.hash) return;
      const periodKey = tipPeriod(ledger.settings.tipFrequency);
      if (
        !periodKey ||
        periodKey === ledger.settings.tipSeenPeriod ||
        periodKey === seenTip.current
      )
        return;
      seenTip.current = periodKey;
      update((l) => ({
        ...l,
        settings: { ...l.settings, tipSeenPeriod: periodKey },
      }));
      setDialog({ type: "tip" });
    };
    if (ledger.accounts.length && !tipChecked.current) {
      tipChecked.current = true;
      check();
    }
    window.addEventListener("focus", check);
    let remove: (() => void) | undefined;
    if (Capacitor.isNativePlatform())
      void NativeApp.addListener("appStateChange", (state) => {
        if (state.isActive) check();
      }).then((handle) => {
        remove = () => {
          void handle.remove();
        };
      });
    return () => {
      window.removeEventListener("focus", check);
      remove?.();
    };
  }, [
    ledger.accounts.length,
    ledger.settings.tipFrequency,
    ledger.settings.tipSeenPeriod,
    dialog,
    update,
  ]);
  function saveWallet(wallet: Account, existing = false) {
    if (!existing && ledger.accounts.length && !entitlement.active)
      throw new Error("Premium unlocks unlimited wallets.");
    if (
      ledger.accounts.some(
        (a) =>
          a.id !== wallet.id &&
          a.name.toLowerCase() === wallet.name.toLowerCase(),
      )
    )
      throw new Error("You already have a wallet with that name.");
    update((l) => ({
      ...(existing ? l : addWallet(l, wallet)),
      accounts: existing
        ? l.accounts.map((a) => (a.id === wallet.id ? wallet : a))
        : [...l.accounts, wallet],
      settings: {
        ...l.settings,
        hasCreatedWallet: true,
        selectedWallet: l.settings.selectedWallet || wallet.id,
        currency: l.accounts.length ? l.settings.currency : wallet.currency,
        monthlyIncomeAccount: l.accounts.length
          ? l.settings.monthlyIncomeAccount
          : wallet.id,
        dailyIncomeAccount: l.accounts.length
          ? l.settings.dailyIncomeAccount
          : wallet.id,
      },
    }));
    close();
    if (ledger.accounts.length) message("Wallet saved.");
  }
  const editTx = (transaction: Transaction) =>
    setDialog({ type: "entry", transaction });
  const addCategory = () => {
    if (!entitlement.active && ledger.categories.length >= 10) {
      setTab("premium");
      message("Your first 10 envelopes are free. Premium makes room for more.");
    } else setDialog({ type: "category" });
  };
  const legal = (page: "privacy" | "terms" | "about" | "delete") => {
    close();
    location.hash = page;
  };
  const changeTab = (next: Tab) => {
    if (next === "settings") setProfilePage("menu");
    setNotificationOrigin(null);
    setTab(next);
    setNotificationsOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  async function deleteData() {
    p.setBusy(true);
    p.setDialogError("");
    try {
      if (user) {
        await deleteCloudAccount();
        await penny.reset();
        await clearNotifications();
      } else {
        await clearNotifications();
        await penny.reset();
      }
      close();
      message("Your account data has been deleted.");
    } catch (caught) {
      p.setDialogError((caught as Error).message);
    } finally {
      p.setBusy(false);
    }
  }
  const monthControl = (
    <div className="month-switch">
      <button
        className="icon-button"
        aria-label="Previous budget period"
        onClick={() => p.setMonthOffset(p.monthOffset - 1)}
      >
        <Icon name="left" size={17} />
      </button>
      <span>
        <Icon name="calendar" size={18} />
        {period.start.toLocaleDateString("en", {
          month: "long",
          year: "numeric",
        })}
      </span>
      <button
        className="icon-button"
        aria-label="Next budget period"
        onClick={() => p.setMonthOffset(p.monthOffset + 1)}
        disabled={p.monthOffset >= 0}
      >
        <Icon name="right" size={17} />
      </button>
    </div>
  );
  if (!ledger.accounts.length)
    return (
      <WalletOnboarding
        ledger={ledger}
        onSave={(wallet) => saveWallet(wallet)}
      />
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => changeTab("home")}
          aria-label="Penny home"
        >
          <span className="brand-mark">
            <img src="/assets/penny-bunny-small.png" alt="" />
          </span>
          <span>
            penny
          </span>
        </button>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${tab === n.id ? "active" : ""}`}
              onClick={() => changeTab(n.id)}
            >
              <Icon name={n.icon} size={23} filled={tab === n.id} />
              <span>{n.label}</span>
              {n.id === "premium" && (
                <span className="nav-pro">
                  {entitlement.active ? "ON" : "PLUS"}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="profile"
            onClick={() =>
              user ? changeTab("settings") : setDialog({ type: "login" })
            }
          >
            <span className="avatar">
              <Icon name="user" size={24} />
            </span>
            <span>
              <strong>
                {user?.user_metadata?.full_name?.split(" ")[0] ||
                  "Your cozy corner"}
              </strong>
              <small>
                {user
                  ? "Signed in · " +
                    (entitlement.active ? "Premium" : "Free plan")
                  : "Device only · Free plan"}
              </small>
            </span>
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Penny</span>
            <Icon name="right" size={14} />
            <strong>
              {tab === "home"
                ? "Overview"
                : tab === "accounts"
                  ? "Wallets"
                  : tab === "settings"
                    ? "Profile"
                    : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </strong>
          </div>
          <button
            className="brand mobile-brand"
            aria-label="Penny home"
            onClick={() => changeTab("home")}
          >
            <span className="brand-mark">
              <img src="/assets/penny-bunny-small.png" alt="" />
            </span>
            <span>
              penny
            </span>
          </button>
          <div className="topbar-actions">
            <button
              className="icon-button premium-top-icon"
              aria-label="Explore Penny Premium"
              title="Penny Premium"
              onClick={() => changeTab("premium")}
            >
              <Icon name="crown" size={23} />
            </button>
            <button
              className="icon-button notification-button"
              aria-label={tipUnread ? "Notifications, new tip" : "Notifications"}
              onClick={() => {
                setNotificationsOpen((open) => !open);
                setTipUnread(false);
                try { localStorage.setItem("penny:notification-tip-seen", dateKey()); } catch { /* Local storage may be unavailable. */ }
              }}
              aria-expanded={notificationsOpen}
            >
              <Icon name="bell" />
              {tipUnread && <span className="notification-dot" />}
            </button>
          </div>
        </header>
        {notificationsOpen && (
          <NotificationCenter
            settings={ledger.settings}
            tip={reportTips[0]?.text || "A fresh month for your next little step."}
            signedIn={!!user}
            premium={entitlement.active}
            onClose={() => setNotificationsOpen(false)}
            onLogin={() => {
              setNotificationsOpen(false);
              setDialog({ type: "login" });
            }}
            onSettings={() => {
              const origin = { tab, profilePage: tab === "settings" ? currentProfilePage.current : undefined };
              setNotificationsOpen(false);
              changeTab("settings");
              setNotificationOrigin(origin);
              setProfilePage("reminders");
            }}
          />
        )}
        <main id="main-content" className={`main-content tab-${tab}`} key={tab}>
          {tab !== "premium" && tab !== "accounts" && (
            <div className="compact-page-top">
              {["home", "reports", "transactions"].includes(tab) ? (
                <>
                  {monthControl}
                  {["home", "reports"].includes(tab) &&
                    ledger.accounts.length > 1 && (
                      <Select
                        aria-label="Active wallet"
                        value={activeWallet.id}
                        onChange={(e) =>
                          update((l) => ({
                            ...l,
                            settings: {
                              ...l.settings,
                              selectedWallet: e.target.value,
                            },
                          }))
                        }
                      >
                        {ledger.accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} · {a.currency}
                          </option>
                        ))}
                      </Select>
                    )}
                </>
              ) : (
                <span className="compact-page-name">
                  {tab === "settings" ? "Your profile" : ""}
                </span>
              )}
            </div>
          )}
          {tab === "reports" && <ReportsTips key={`${activeWallet.id}-${dateKey(period.start)}`} tips={reportTips} />}
          {penny.error && (
            <div className="error-banner" role="alert">
              <Icon name="warning" />
              <span>{penny.error}</span>
              <button className="text-button" onClick={penny.retrySync}>
                Retry
              </button>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => penny.setError("")}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          )}
          {tab === "home" && (
            <CompactHome
              ledger={scopedLedger}
              transactions={periodTransactions}
              onAddCategory={addCategory}
              onEditCategory={(category) =>
                setDialog({ type: "category", category })
              }
            />
          )}
          {tab === "transactions" && (
            <>
              <div className="transaction-tools">
                <label className="search-field">
                  <Icon name="search" size={19} />
                  <input
                    aria-label="Search transactions"
                    placeholder="Search transactions"
                    value={p.search}
                    onChange={(e) => p.setSearch(e.target.value)}
                  />
                  {p.search && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => p.setSearch("")}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </label>
                <button
                  className="icon-button filter-toggle"
                  aria-label="Transaction filters"
                  aria-expanded={showFilters}
                  onClick={() => setShowFilters((open) => !open)}
                >
                  <Icon name="sliders" size={21} />
                </button>
              </div>
              {showFilters && (
                <div className="transaction-filter-row">
                  <Select
                    aria-label="Transaction type"
                    value={p.kindFilter}
                    onChange={(e) => p.setKindFilter(e.target.value)}
                  >
                    <option value="all">All types</option>
                    <option value="expense">Expenses</option>
                    <option value="income">Income</option>
                  </Select>
                  <Select
                    aria-label="Wallet filter"
                    value={p.accountFilter}
                    onChange={(e) => p.setAccountFilter(e.target.value)}
                  >
                    <option value="all">All wallets</option>
                    {ledger.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label="Date range"
                    value={p.allTime ? "all" : "period"}
                    onChange={(e) => p.setAllTime(e.target.value === "all")}
                  >
                    <option value="period">This period</option>
                    <option value="all">All time</option>
                  </Select>
                </div>
              )}
              <div className="section-heading transaction-heading">
                <p>
                  {filtered.length} transaction
                  {filtered.length === 1 ? "" : "s"}
                  {p.allTime ? " · All time" : ""}
                </p>
                <div className="transaction-icon-actions">
                  <button
                    className="icon-button"
                    aria-label="Import"
                    title="Import"
                    onClick={() => setDialog({ type: "import" })}
                  >
                    <Icon name="upload" size={19} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Export"
                    title="Export CSV"
                    onClick={() => {
                      void exportTransactions(ledger, filtered)
                        .then(() => message("Your CSV is ready."))
                        .catch(() =>
                          message("Export failed. Please try again."),
                        );
                    }}
                  >
                    <Icon name="download" size={19} />
                  </button>
                </div>
              </div>
              <section className="panel all-transactions">
                <TransactionList
                  ledger={ledger}
                  transactions={filtered.slice(0, p.pageSize)}
                  onEdit={editTx}
                />
                {filtered.length > p.pageSize && (
                  <button
                    className="button secondary full"
                    onClick={() => p.setPageSize(p.pageSize + 50)}
                  >
                    Show 50 more
                  </button>
                )}
              </section>
            </>
          )}
          {tab === "reports" && (
            <Suspense fallback={<p className="muted">Loading reports…</p>}>
              <div className="reports-grid">
                <section className="panel report-summary">
                  <div className="report-numbers">
                    <div>
                      <small>Income</small>
                      <strong className="positive">{money(income)}</strong>
                    </div>
                    <div>
                      <small>Spending</small>
                      <strong>{money(spent)}</strong>
                    </div>
                    <div>
                      <small>Left from income</small>
                      <strong>{money(income - spent)}</strong>
                    </div>
                  </div>
                  <SpendingChart
                    ledger={scopedLedger}
                    start={period.start}
                    end={period.end}
                  />
                </section>
                <section className="panel">
                  <h2>Your spending mix</h2>
                  <Breakdown
                    ledger={scopedLedger}
                    transactions={periodTransactions}
                  />
                </section>
                {entitlement.active ? (
                  <>
                    <section className="panel trend-panel">
                      <h2>Six months of little habits</h2>
                      <p className="muted">
                        Calendar-month income and expenses side by side.
                      </p>
                      <TrendChart ledger={scopedLedger} />
                    </section>
                    <AdvancedReports ledger={scopedLedger} />
                    <section className="panel insights-panel">
                      <h2>A closer look</h2>
                      <div className="insight">
                        <small>Saved from this period’s income</small>
                        <strong>
                          {income > 0
                            ? `${Math.round(((income - spent) / income) * 100)}%`
                            : "—"}
                        </strong>
                      </div>
                      <small>
                        These figures describe your entries, not financial
                        advice. Transfers recorded as expenses are included.
                      </small>
                    </section>
                  </>
                ) : (
                  <section className="report-upgrade">
                    <span className="category-icon color-peach">
                      <Icon name="lock" size={28} />
                    </span>
                    <div>
                      <h2>There’s more to your money story.</h2>
                      <p>
                        Explore trends, custom dates and weekday patterns with
                        Premium.
                      </p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() => changeTab("premium")}
                    >
                      <Icon name="crown" size={20} />
                      Explore Premium
                    </button>
                  </section>
                )}
              </div>
            </Suspense>
          )}
          {tab === "accounts" && (
            <>
              <div className="section-heading wallets-heading">
                <h2>
                  Wallets{" "}
                  <span className="count-badge">{ledger.accounts.length}</span>
                </h2>
                <button
                  className="button secondary small"
                  onClick={() =>
                    entitlement.active || ledger.accounts.length === 0
                      ? setDialog({ type: "account" })
                      : changeTab("premium")
                  }
                >
                  <Icon name={entitlement.active ? "plus" : "lock"} size={18} />
                  Add wallet
                </button>
              </div>
              <div className="accounts-grid">
                {ledger.accounts.map((a, index) => {
                  const envelopes = walletLedger(ledger, a.id).categories;
                  const walletTransactions = ledger.transactions.filter((t) => t.accountId === a.id);
                  const walletSpent = walletTransactions.filter((t) => t.kind === "expense" && inPeriod(t, period.start, period.end)).reduce((sum, t) => sum + t.amount, 0);
                  const walletBudget = envelopes.reduce((sum, c) => sum + c.budget, 0);
                  return (
                    <article className={`account-card panel wallet-tone-${index % 3}`} key={a.id}>
                      <button className="account-card-open" onClick={() => setDialog({ type: "account", account: a })} aria-label={`Edit ${a.name} wallet`}>
                        <div className="account-card-top">
                          <span className="wallet-avatar"><Icon name={a.icon} size={24} /></span>
                          <span className="wallet-identity"><strong>{a.name}</strong><small>{a.currency} wallet</small></span>
                          <span className="wallet-edit"><Icon name="edit" size={17} /></span>
                        </div>
                        <div className="wallet-balance">
                          <span>Available balance</span>
                          <strong className={accountBalance(ledger, a.id) < 0 ? "negative" : ""}>{formatMoney(accountBalance(ledger, a.id), walletSettings(ledger, a.id))}</strong>
                        </div>
                      </button>
                      {envelopes.length ? (
                        <div className="wallet-card-progress">
                          <div><span>Spent this period</span><strong>{formatMoney(walletSpent, walletSettings(ledger, a.id))}<span>{walletBudget ? ` / ${formatMoney(walletBudget, walletSettings(ledger, a.id))}` : ""}</span></strong></div>
                          {walletBudget > 0 && (
                            <div className="progress-track" role="progressbar" aria-label={`${a.name} budget used`} aria-valuenow={Math.min(100, Math.round(walletSpent / walletBudget * 100))} aria-valuemin={0} aria-valuemax={100}>
                              <span style={{ transform: `scaleX(${Math.min(1, walletSpent / walletBudget)})` }} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="wallet-card-empty"><Icon name="sparkle" size={17} /><span>Ready for your first envelope</span></div>
                      )}
                      {envelopes.length ? (
                        <div className="wallet-envelope-count"><Icon name="basket" size={15} /> {envelopes.length} envelope{envelopes.length === 1 ? "" : "s"}</div>
                      ) : (
                        <button className="wallet-card-link" onClick={() => {
                          update((l) => ({ ...l, settings: { ...l.settings, selectedWallet: a.id } }));
                          changeTab("home");
                          setDialog({ type: "category" });
                        }}><span>Create envelope</span><Icon name="right" size={17} /></button>
                      )}
                      <button className="wallet-card-link wallet-card-income" onClick={() => setDialog({ type: "income", accountId: a.id })}>
                        <span><Icon name="down" size={16} /> {a.incomeSchedules.length ? `${a.incomeSchedules.length} income schedule${a.incomeSchedules.length === 1 ? "" : "s"}` : "Set recurring income"}</span>
                        <Icon name="right" size={17} />
                      </button>
                    </article>
                  );
                })}
                {!entitlement.active && (
                  <button
                    className="account-upgrade"
                    onClick={() => changeTab("premium")}
                  >
                    <img src="/assets/penny-bunny-small.png" alt="" />
                    <Icon name="crown" size={24} />
                    <h3>A place for every pocket</h3>
                    <p>Unlimited wallets. A currency and envelopes for each.</p>
                    <span>
                      Explore Premium · $5/month <Icon name="arrow" size={18} />
                    </span>
                  </button>
                )}
              </div>
            </>
          )}
          {tab === "premium" && (
            <Premium
              entitlement={entitlement}
              signedIn={!!user}
              onLogin={() => setDialog({ type: "login" })}
              onChange={penny.setEntitlement}
              onLegal={legal}
            />
          )}
          {tab === "settings" && (
            <Profile
              initialPage={profilePage}
              onPageChange={(page) => { currentProfilePage.current = page; }}
              onBackFromNotifications={notificationOrigin ? () => {
                changeTab(notificationOrigin.tab);
                if (notificationOrigin.tab === "settings") setProfilePage(notificationOrigin.profilePage || "menu");
              } : undefined}
              onPremium={() => setTab("premium")}
              ledger={ledger}
              signedIn={!!user}
              premium={entitlement.active}
              update={update}
              onImport={() => setDialog({ type: "import" })}
              onReset={() => setDialog({ type: "reset" })}
              onDelete={() => setDialog({ type: "delete" })}
              onLegal={legal}
              onLogin={() => setDialog({ type: "login" })}
              onLogout={() => {
                void supabase?.auth
                  .signOut()
                  .then(() => message("You’re signed out."))
                  .catch(() => message("Sign-out failed. Please try again."));
              }}
              onReload={() => {
                if (
                  window.confirm(
                    "Replace this device’s ledger with the cloud version? Export a backup of local changes first.",
                  )
                )
                  void penny
                    .reloadCloud()
                    .then(() => message("Your cloud ledger is loaded."))
                    .catch(() =>
                      message("Could not reload. Check your connection."),
                    );
              }}
              onCloudEnable={() => {
                if (!user) {
                  setDialog({ type: "login" });
                  return;
                }
                void loadCloud(user.id)
                  .then((remote) => setDialog({ type: "cloud", remote }))
                  .catch(() =>
                    message(
                      "Could not connect to cloud. Check your connection.",
                    ),
                  );
              }}
              onCloudDisable={() => {
                penny.disableCloud();
                message("Cloud sync is off. Your local records stay here.");
              }}
              onCloudDelete={() => {
                if (
                  window.confirm(
                    "Delete the cloud ledger and stop sync? This device’s data stays. Other devices may still hold offline copies.",
                  )
                )
                  void penny
                    .deleteCloudCopy()
                    .then(() =>
                      message("Cloud copy deleted. Local ledger kept."),
                    )
                    .catch((error) => message(error.message));
              }}
              onMessage={message}
            />
          )}
          {false && (
            <footer className="app-footer">
              <span>
                <Icon
                  name={ledger.settings.cloudSync ? "cloud" : "shield"}
                  size={15}
                />
                {ledger.settings.cloudSync
                  ? penny.status
                  : "Your little ledger is saved on this device"}
              </span>
              <span>
                Made for little steps & big dreams{" "}
                <Icon name="heart" size={13} />
              </span>
            </footer>
          )}
        </main>
      </div>
      {tab === "home" && (
        <button
          className="mobile-fab"
          aria-label="Add transaction"
          onClick={() => setDialog({ type: "entry" })}
        >
          <Icon name="plus" size={30} />
        </button>
      )}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map((n) => (
          <button
            key={n.id}
            className={tab === n.id ? "active" : ""}
            onClick={() => changeTab(n.id)}
          >
            <Icon name={n.icon} size={23} filled={tab === n.id} />
            <span>{n.id === "home" ? "Home" : n.label}</span>
          </button>
        ))}
      </nav>
      {p.toast && !dialog && (
        <div className="toast" role="status">
          <Icon name="info" size={21} />
          {p.toast}
          <button
            aria-label="Dismiss notification"
            className="icon-button"
            onClick={() => message("")}
          >
            <Icon name="close" size={17} />
          </button>
        </div>
      )}
      {dialog && (
        <Modal
          title={
            dialog.type === "entry"
              ? dialog.transaction
                ? "Edit transaction"
                : "New transaction"
              : dialog.type === "category"
                ? dialog.category
                  ? "Your envelope & budget"
                  : "New envelope"
                : dialog.type === "account"
                  ? dialog.account
                    ? "Your wallet"
                    : "A new money pocket"
                  : dialog.type === "income"
                    ? "Your recurring income"
                    : dialog.type === "import"
                      ? "Bring your history along"
                      : dialog.type === "login"
                        ? "Welcome to your cozy corner"
                        : dialog.type === "reset"
                          ? "Refresh this month’s progress"
                          : dialog.type === "delete"
                            ? "Delete account & data"
                            : dialog.type === "fresh"
                              ? "Make Penny your own"
                              : dialog.type === "cloud"
                                ? "Choose your cloud ledger"
                                : dialog.type === "expired"
                                  ? "A little membership check-in"
                                  : dialog.type === "tip"
                                    ? "A little Penny tip"
                                    : dialog.type === "legal" &&
                                        dialog.page === "privacy"
                                      ? "Privacy policy"
                                      : dialog.type === "legal" &&
                                          dialog.page === "terms"
                                        ? "Terms & conditions"
                                        : dialog.type === "legal" &&
                                            dialog.page === "about"
                                          ? "About Penny"
                                          : "Account deletion"
          }
          wide={dialog.type === "import" || dialog.type === "legal"}
          onClose={close}
        >
          {dialog.type === "entry" && (
            <EntryForm
              ledger={ledger}
              onSaveDescription={(text) => {
                update((l) => ({
                  ...l,
                  settings: {
                    ...l.settings,
                    savedDescriptions: l.settings.savedDescriptions.some(
                      (value) => value.toLowerCase() === text.toLowerCase(),
                    )
                      ? l.settings.savedDescriptions
                      : [...l.settings.savedDescriptions, text],
                  },
                }));
              }}
              onRemoveDescription={(text) => update((l) => ({
                ...l,
                settings: { ...l.settings, savedDescriptions: l.settings.savedDescriptions.filter((value) => value !== text) },
              }))}
              initial={dialog.transaction}
              initialKind={dialog.kind}
              initialCategory={dialog.categoryId}
              onSave={(tx) => {
                update((l) => ({
                  ...l,
                  transactions: dialog.transaction
                    ? l.transactions.map((t) => (t.id === tx.id ? tx : t))
                    : [...l.transactions, tx],
                }));
                close();
                message(
                  dialog.transaction
                    ? "Your little edit is saved."
                    : tx.kind === "income"
                      ? "A little more in your pocket. Income added!"
                      : "Every penny has a home. Expense added!",
                );
              }}
              onDelete={() => {
                if (window.confirm("Delete this transaction?")) {
                  update((l) => ({
                    ...l,
                    transactions: l.transactions.filter(
                      (t) => t.id !== dialog.transaction?.id,
                    ),
                  }));
                  close();
                  message("Transaction deleted.");
                }
              }}
            />
          )}
          {dialog.type === "category" && (
            <CategoryForm
              initial={dialog.category}
              premium={entitlement.active}
              onPremium={() => {
                close();
                setTab("premium");
              }}
              settings={scopedLedger.settings}
              hasHistory={ledger.transactions.some(
                (t) => t.categoryId === dialog.category?.id,
              )}
              onSave={(category) => {
                if (
                  ledger.categories.some(
                    (c) =>
                      c.id !== category.id &&
                      c.walletId === activeWallet.id &&
                      c.name.toLowerCase() === category.name.toLowerCase(),
                  )
                )
                  throw new Error(
                    "You already have a envelope with that name.",
                  );
                update((l) => ({
                  ...l,
                  categories: dialog.category
                    ? l.categories.map((c) =>
                        c.id === category.id
                          ? {
                              ...category,
                              walletId: activeWallet.id,
                              budget: c.budget,
                              walletBudgets: {
                                ...c.walletBudgets,
                                [activeWallet.id]: category.budget,
                              },
                            }
                          : c,
                      )
                    : [
                        ...l.categories,
                        {
                          ...category,
                          walletId: activeWallet.id,
                          budget: 0,
                          walletBudgets: { [activeWallet.id]: category.budget },
                        },
                      ],
                }));
                close();
                message("Your envelope is ready.");
              }}
              onDelete={() => {
                update((l) => ({
                  ...l,
                  categories: l.categories.filter(
                    (c) => c.id !== dialog.category?.id,
                  ),
                }));
                close();
                message("Envelope deleted.");
              }}
            />
          )}
          {dialog.type === "account" && (
            <WalletForm
              ledger={ledger}
              initial={dialog.account}
              onSave={(account) => saveWallet(account, !!dialog.account)}
              onDelete={() => {
                if (
                  ledger.transactions.some(
                    (t) => t.accountId === dialog.account?.id,
                  )
                )
                  return;
                update((l) => ({
                  ...l,
                  accounts: l.accounts.filter(
                    (a) => a.id !== dialog.account?.id,
                  ),
                  categories: l.categories.filter(
                    (c) => c.walletId !== dialog.account?.id,
                  ),
                  settings: {
                    ...l.settings,
                    selectedWallet:
                      l.settings.selectedWallet === dialog.account?.id
                        ? l.accounts.find((a) => a.id !== dialog.account?.id)
                            ?.id || ""
                        : l.settings.selectedWallet,
                    dailyIncomeAccount:
                      l.settings.dailyIncomeAccount === dialog.account?.id
                        ? ""
                        : l.settings.dailyIncomeAccount,
                    dailyIncome:
                      l.settings.dailyIncomeAccount === dialog.account?.id
                        ? 0
                        : l.settings.dailyIncome,
                    monthlyIncome:
                      l.settings.monthlyIncomeAccount === dialog.account?.id
                        ? 0
                        : l.settings.monthlyIncome,
                    monthlyIncomeAccount:
                      l.settings.monthlyIncomeAccount === dialog.account?.id
                        ? l.accounts.find((a) => a.id !== dialog.account?.id)
                            ?.id || ""
                        : l.settings.monthlyIncomeAccount,
                  },
                }));
                close();
              }}
            />
          )}
          {dialog.type === "income" && (
            <IncomeForm
              ledger={ledger}
              wallet={ledger.accounts.find((a) => a.id === dialog.accountId)!}
              onSave={(walletId, schedules) => {
                update((l) => applyScheduledIncome({ ...l, accounts: l.accounts.map((a) => a.id === walletId ? { ...a, incomeSchedules: schedules } : a) }));
                close();
                message("Your income schedule is saved.");
              }}
            />
          )}
          {dialog.type === "tip" && (
            <div className="form-stack little-tip-popup">
              <Icon name="leaf" size={36} />
              <h3>A little insight</h3>
              <p>{reportTips[0]?.text}</p>
              <button className="button primary full" onClick={close}>
                A little noted ♡
              </button>
              <button
                className="text-button"
                onClick={() => {
                  close();
                  changeTab("reports");
                  window.setTimeout(() => document.getElementById("reports-tip")?.scrollIntoView({ behavior: "smooth" }), 80);
                }}
              >
                See more tips
              </button>
            </div>
          )}
          {dialog.type === "import" && (
            <ImportForm
              ledger={ledger}
              onImport={(transactions) => {
                update((l) => ({
                  ...l,
                  transactions: [...l.transactions, ...transactions],
                }));
                close();
                message(
                  `${transactions.length} money moments, safely brought along.`,
                );
              }}
              onRestore={(restored) => {
                if (
                  !entitlement.active &&
                  (restored.categories.length > 10 ||
                    restored.accounts.length > 1)
                ) {
                  message(
                    "This backup has Premium envelopes or wallets. Sign in with an active Premium membership to restore it.",
                  );
                  return;
                }
                update((l) => ({
                  ...restored,
                  demo: false,
                  settings: {
                    ...restored.settings,
                    cloudSync: l.settings.cloudSync,
                  },
                }));
                close();
                message("Your full backup is restored.");
              }}
            />
          )}
          {dialog.type === "login" && (
            <AuthForm onSuccess={close} onLegal={legal} />
          )}
          {dialog.type === "legal" && (
            <Legal
              page={dialog.page}
              onDelete={() => {
                close();
                setTab("settings");
              }}
            />
          )}
          {dialog.type === "cloud" && (
            <div className="form-stack">
              <p>
                Enable cloud sync to store a copy of your financial ledger in
                your signed-in account. Your data also stays on this device. You
                can turn sync off or delete the cloud copy later.
              </p>
              {dialog.remote && (
                <div className="notice">
                  <Icon name="info" />
                  <p>
                    This account already has a cloud ledger. Export a backup
                    before replacing either copy. Penny won’t merge them
                    automatically.
                  </p>
                </div>
              )}
              {dialog.remote && (
                <button
                  className="button secondary full"
                  onClick={() => {
                    void penny
                      .enableCloud("download", dialog.remote)
                      .then(() => {
                        close();
                        message(
                          "Cloud sync enabled. Your cloud ledger is now on this device.",
                        );
                      })
                      .catch((error) => message(error.message));
                  }}
                >
                  Use existing cloud ledger on this device
                </button>
              )}
              <button
                className="button primary full"
                onClick={() => {
                  if (
                    dialog.remote &&
                    !window.confirm(
                      "Replace the existing cloud ledger with this device’s data? Keep a backup first.",
                    )
                  )
                    return;
                  void penny
                    .enableCloud("upload", dialog.remote)
                    .then(() => {
                      close();
                      message(
                        "Cloud sync enabled. Your ledger will now upload.",
                      );
                    })
                    .catch((error) => message(error.message));
                }}
              >
                {dialog.remote
                  ? "Replace cloud ledger with this device’s data"
                  : "Enable sync & upload my ledger"}
              </button>
              <button className="text-button" onClick={close}>
                Keep my data on this device only
              </button>
            </div>
          )}
          {dialog.type === "reset" && (
            <div className="form-stack">
              <p>
                Start this month’s envelope bars fresh. Your transactions stay in history and reports.
              </p>
              <button
                className="button primary full"
                onClick={() => {
                  update((l) => ({
                    ...l,
                    settings: {
                      ...l.settings,
                      manualResetAt: new Date().toISOString(),
                    },
                  }));
                  close();
                  message("Fresh budgets, same lovely history.");
                }}
              >
                Refresh progress
              </button>
              <button className="button secondary full" onClick={close}>
                Keep this period
              </button>
            </div>
          )}
          {dialog.type === "delete" && (
            <div className="form-stack">
              <p>
                This permanently deletes{" "}
                {user
                  ? "your Penny account, cloud ledger and saved data on this device"
                  : "your saved Penny ledger on this device"}
                . Export a backup first if you want to keep anything.
              </p>
              <div className="notice">
                <Icon name="info" />
                <p>
                  Cancel any active Google Play subscription separately. Clear
                  offline copies on your other devices too.
                </p>
              </div>
              <label>
                Type DELETE to confirm
                <input
                  value={p.deleteWord}
                  onChange={(e) => p.setDeleteWord(e.target.value)}
                  autoComplete="off"
                  placeholder="DELETE"
                />
              </label>
              {p.dialogError && (
                <p role="alert" className="form-error">
                  {p.dialogError}
                </p>
              )}
              <button
                className="button danger full"
                disabled={p.deleteWord !== "DELETE" || p.busy}
                onClick={() => {
                  void deleteData();
                }}
              >
                {p.busy ? "Deleting…" : "Permanently delete my data"}
              </button>
              <button className="button secondary full" onClick={close}>
                Keep my data
              </button>
            </div>
          )}
          {dialog.type === "expired" && (
            <div className="form-stack">
              <img
                className="dialog-bunny"
                src="/assets/penny-bunny.png"
                alt="Penny bunny"
              />
              <p>
                Your Premium membership has ended. Your transactions and
                existing envelopes are still here. Renew whenever you’re ready
                for more wallets and deeper insights.
              </p>
              <button
                className="button primary full"
                onClick={() => {
                  close();
                  setTab("premium");
                }}
              >
                Explore renewal
              </button>
              <button className="button secondary full" onClick={close}>
                Maybe later
              </button>
              <small>
                We’ll show this reminder once for this expired membership.
              </small>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
