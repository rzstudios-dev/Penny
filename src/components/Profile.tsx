import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  formatMoney,
  walletSettings,
  type Ledger,
  type Settings,
} from "../lib/model";
import {
  configureNotifications,
  sendTestNotification,
  notificationStatus,
} from "../lib/notifications";
import { exportTransactions, exportFullBackup } from "../lib/files";
import Select from "./Select";
import Icon from "./Icon";

export type ProfilePage =
  | "menu"
  | "appearance"
  | "reminders"
  | "data"
  | "backups"
  | "details"
  | "delete";
type Props = {
  initialPage?: ProfilePage;
  onBackFromNotifications?: () => void;
  onPageChange?: (page: ProfilePage) => void;
  onPremium: () => void;
  ledger: Ledger;
  signedIn: boolean;
  premium: boolean;
  update: (updater: (ledger: Ledger) => Ledger) => void;
  onImport: () => void;
  onReset: () => void;
  onDelete: () => void;
  onLegal: (page: "privacy" | "terms" | "about" | "delete") => void;
  onLogin: () => void;
  onLogout: () => void;
  onReload: () => void;
  onCloudEnable: () => void;
  onCloudDisable: () => void;
  onCloudDelete: () => void;
  onMessage: (message: string) => void;
};
const sections: {
  id: ProfilePage;
  icon: string;
  title: string;
  note: string;
}[] = [
  {
    id: "appearance",
    icon: "sliders",
    title: "Display & amount entry",
    note: "Dates, decimals and calculator",
  },
  {
    id: "data",
    icon: "cloud",
    title: "Sign-in & cloud sync",
    note: "Your data stays local until you choose sync",
  },
  {
    id: "backups",
    icon: "download",
    title: "Backups & imports",
    note: "Export, import and restore",
  },
  {
    id: "details",
    icon: "shield",
    title: "About & policies",
    note: "Legal details and a clean slate",
  },
  {
    id: "delete",
    icon: "trash",
    title: "Delete account & data",
    note: "Clear your records",
  },
];

export default function Profile(props: Props) {
  const { ledger, update, onMessage } = props,
    s = ledger.settings;
  const [page, setPage] = useState<ProfilePage>(props.initialPage || "menu"),
    [frequency, setFrequency] = useState(s.reminders),
    [hour, setHour] = useState(s.reminderHour),
    [promo, setPromo] = useState(s.premiumReminder),
    [loginReminder, setLoginReminder] = useState(s.loginReminder),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  useEffect(() => {
    setPage(props.initialPage || "menu");
  }, [props.initialPage]);
  useEffect(() => {
    props.onPageChange?.(page);
  }, [page, props.onPageChange]);
  useEffect(() => {
    if (page === "reminders")
      void notificationStatus()
        .then(setStatus)
        .catch(() => setStatus("Could not read notification settings."));
  }, [page]);
  const setting = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    update((l) => ({ ...l, settings: { ...l.settings, [key]: value } }));
  async function reminders() {
    setBusy(true);
    const next = {
      ...s,
      reminders: frequency,
      reminderHour: hour,
      premiumReminder: promo,
      loginReminder,
    };
    update((l) => ({ ...l, settings: next }));
    try {
      await configureNotifications(next, props.premium, props.signedIn, true);
      setStatus(await notificationStatus());
      onMessage("Your reminder preferences are saved.");
    } catch (caught) {
      onMessage((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download(full: boolean) {
    try {
      if (full) await exportFullBackup(ledger);
      else await exportTransactions(ledger);
      onMessage("Your backup is ready. Keep it somewhere safe.");
    } catch {
      onMessage("Backup could not be saved. Please try again.");
    }
  }
  const action = (
    icon: string,
    title: string,
    note: string,
    onClick: () => void,
  ) => (
    <button className="settings-action" onClick={onClick}>
      <span className="profile-row-icon">
        <Icon name={icon} size={21} />
      </span>
      <span>
        <strong>{title}</strong>
        {note && <small>{note}</small>}
      </span>
      <Icon name="right" size={17} />
    </button>
  );
  return (
    <div className="profile-pages">
      {page !== "menu" && (
        <div className="settings-page-header">
          <button
            className="icon-button"
            aria-label={page === "reminders" && props.onBackFromNotifications ? "Back to previous page" : "Back to profile"}
            onClick={() => {
              if (page === "reminders" && props.onBackFromNotifications) props.onBackFromNotifications();
              else setPage("menu");
            }}
          >
            <Icon name="left" size={20} />
          </button>
          <h2>{page === "reminders" ? "Notifications" : sections.find((item) => item.id === page)?.title}</h2>
        </div>
      )}
      {page === "menu" && (
        <>
          <button
            className="profile-membership membership-banner"
            onClick={props.onPremium}
          >
            <img
              className="membership-bunny"
              src="/assets/penny-bunny-small.png"
              alt=""
            />
            <div className="membership-copy">
              <h3>
                <Icon name="crown" size={20} />
                {props.premium ? "Your Premium" : "Make room for more"}
              </h3>
              <p>
                {props.premium
                  ? "Your Premium features are unlocked."
                  : "Unlimited wallets, 40 icons & deeper reports."}
              </p>
              <span className="membership-cta">
                {props.premium
                  ? "Manage membership"
                  : "Explore Premium · $5/month"}
                <Icon name="arrow" size={17} />
              </span>
            </div>
          </button>
          <section className="panel profile-menu profile-menu-compact">
            {action("reset", "Refresh this month’s progress", "", props.onReset)}
            {sections.map((item) => (
              <div key={item.id}>
                {action(item.icon, item.title, "", () => setPage(item.id))}
              </div>
            ))}
          </section>
          <small className="profile-local-note">
            <Icon name={s.cloudSync ? "cloud" : "offline"} size={16} />
            {s.cloudSync
              ? "Cloud sync is enabled"
              : "Saved on this device · cloud sync is off"}
          </small>
        </>
      )}
      {page === "appearance" && (
        <section className="panel settings-section">
          <label>
            Date order
            <Select
              value={s.dateOrder}
              onChange={(e) =>
                setting("dateOrder", e.target.value as Settings["dateOrder"])
              }
            >
              <option value="DMY">Day / Month / Year</option>
              <option value="MDY">Month / Day / Year</option>
              <option value="YMD">Year / Month / Day</option>
            </Select>
          </label>
          <div className="form-grid">
            <label>
              Decimal digits
              <Select
                value={s.decimals}
                onChange={(e) => setting("decimals", Number(e.target.value))}
              >
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </Select>
            </label>
            <label>
              Decimal mark
              <Select
                value={s.decimalMark}
                onChange={(e) =>
                  setting(
                    "decimalMark",
                    e.target.value as Settings["decimalMark"],
                  )
                }
              >
                <option value=".">Dot (12.50)</option>
                <option value=",">Comma (12,50)</option>
              </Select>
            </label>
          </div>
          <div className="format-preview">
            Preview
            <strong>
              {formatMoney(12345678, walletSettings(ledger, s.selectedWallet))}
            </strong>
          </div>
          <label className="toggle-row">
            <span>
              <strong>Amount calculator</strong>
              <small>Type calculations in the amount field</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={s.calculator}
              onChange={(e) => setting("calculator", e.target.checked)}
            />
          </label>
          <small>Set each wallet’s currency from Wallets.</small>
        </section>
      )}
      {page === "reminders" && (
        <section className="panel settings-section" id="reminders">
          <p className="notification-permission-status">
            <Icon name="bell" size={17} />
            {status}
          </p>
          <div className="form-grid">
            <label>
              Budget check-ins
              <Select
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as Settings["reminders"])
                }
              >
                <option value="never">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly · Sundays</option>
                <option value="monthly">Monthly · 1st</option>
              </Select>
            </label>
            <label>
              Time
              <Select
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}:00
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <label className="toggle-row">
            <span>
              <strong>Weekly sign-in reminder</strong>
              <small>Only while signed out · turn on sync to back up</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={loginReminder}
              onChange={(e) => setLoginReminder(e.target.checked)}
            />
          </label>
          <label className="toggle-row">
            <span>
              <strong>Monthly Premium invitation</strong>
              <small>Only on the free plan</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={promo}
              onChange={(e) => setPromo(e.target.checked)}
            />
          </label>
          <label>
            Tips when opening Penny
            <Select
              value={s.tipFrequency}
              onChange={(event) => setting("tipFrequency", event.target.value as Settings["tipFrequency"])}
            >
              <option value="never">Never</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </label>
          <small>
            Each reminder has its own control. Android may delay delivery to
            preserve battery.
          </small>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => {
              void reminders();
            }}
          >
            Save reminder preferences
          </button>
          {Capacitor.isNativePlatform() && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void sendTestNotification()
                  .then(() => onMessage("A little test arrives in 5 seconds."))
                  .catch((error) => onMessage(error.message))
                  .finally(() => setBusy(false));
              }}
            >
              Send a test notification
            </button>
          )}
        </section>
      )}
      {page === "data" && (
        <section className="panel settings-section">
          {action(
            "user",
            props.signedIn ? "Sign out" : "Sign in to Penny",
            "Google or email · sign-in does not upload your ledger",
            props.signedIn ? props.onLogout : props.onLogin,
          )}
          <label className="toggle-row">
            <span>
              <strong>Cloud sync</strong>
              <small>Off by default. Upload only when you enable it.</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={s.cloudSync}
              onChange={(e) =>
                e.target.checked
                  ? props.onCloudEnable()
                  : props.onCloudDisable()
              }
            />
          </label>
          <small>
            {s.cloudSync
              ? "Turning sync off stops future uploads. Delete the cloud copy separately if desired."
              : "Your entries are saved only on this device. Keep a backup before clearing app data or uninstalling."}
          </small>
          {props.signedIn && (
            <>
              {action(
                "reset",
                "Reload cloud data",
                "Export a backup first",
                props.onReload,
              )}
              {action(
                "trash",
                "Delete cloud copy only",
                "Keep your local records",
                props.onCloudDelete,
              )}
            </>
          )}
        </section>
      )}
      {page === "backups" && (
        <section className="panel settings-section">
          {action(
            "download",
            "Export transactions as CSV",
            "Every income and expense with its wallet currency",
            () => {
              void download(false);
            },
          )}
          {action(
            "file",
            "Download a full backup",
            "Wallets, envelopes, transactions and preferences",
            () => {
              void download(true);
            },
          )}
          {action(
            "upload",
            "Import or restore a backup",
            "CSV, Excel (.xlsx) or a Penny backup",
            props.onImport,
          )}
        </section>
      )}
      {page === "details" && (
        <>
          <section className="panel profile-menu">
            {(["privacy", "terms", "about", "delete"] as const).map((id, i) => (
              <div key={id}>
                {action(
                  "file",
                  [
                    "Privacy policy",
                    "Terms & conditions",
                    "About Penny",
                    "Account deletion information",
                  ][i],
                  "Open page",
                  () => props.onLegal(id),
                )}
              </div>
            ))}
          </section>
        </>
      )}
      {page === "delete" && (
        <section className="panel settings-section danger-zone">
          <h3>A clean slate</h3>
          <p>Export anything you want to keep before deleting your data.</p>
          <button className="button danger" onClick={props.onDelete}>
            {props.signedIn
              ? "Delete account & all data"
              : "Delete all device data"}
          </button>
          <small>Cancel any Google Play subscription separately.</small>
        </section>
      )}
    </div>
  );
}
