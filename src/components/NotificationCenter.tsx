import type { Settings } from "../lib/model";
import Icon from "./Icon";
export default function NotificationCenter({
  settings,
  tip,
  signedIn,
  premium,
  onLogin,
  onClose,
}: {
  settings: Settings;
  tip: string;
  signedIn: boolean;
  premium: boolean;
  onLogin: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        className="popover-dismiss"
        aria-label="Close notifications"
        onClick={onClose}
      />
      <section className="notification-center" aria-label="Your notifications">
        <header>
          <h2>A little check-in</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close notification panel"
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="notification-item">
          <span className="category-icon color-sage">
            <Icon name="leaf" size={23} />
          </span>
          <div>
            <strong>This month in Penny</strong>
            <p>{tip}</p>
          </div>
        </div>
        {!signedIn && (
          <button className="notification-item login-notice" onClick={onLogin}>
            <span className="category-icon color-peach">
              <Icon name="cloud" size={23} />
            </span>
            <div>
              <strong>Keep your pennies safe.</strong>
              <p>Sign in & enable cloud sync.</p>
            </div>
            <Icon name="right" size={16} />
          </button>
        )}
        <p className="notification-schedule">
          {settings.reminders === "never"
            ? "Budget check-ins are off."
            : `${settings.reminders.charAt(0).toUpperCase() + settings.reminders.slice(1)} check-ins at ${String(settings.reminderHour).padStart(2, "0")}:00.`}
          {!signedIn && settings.loginReminder ? " Monthly sign-in reminder is on." : ""}
        </p>
      </section>
    </>
  );
}
