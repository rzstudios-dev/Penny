import { useEffect, useState, type FormEvent } from "react";
import { googleLogin, sendCode, verifyCode, supabase } from "../lib/cloud";
import Icon from "./Icon";
export default function AuthForm({
  onSuccess,
  onLegal,
}: {
  onSuccess: () => void;
  onLegal: (page: "privacy" | "terms") => void;
}) {
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [accepted, setAccepted] = useState(false),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (session?.user) onSuccess();
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, [onSuccess]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (sent) {
        await verifyCode(email, code);
        onSuccess();
      } else {
        await sendCode(email);
        setSent(true);
        setCooldown(60);
      }
    });
  };
  return (
    <div className="form-stack">
      <div className="auth-intro">
        <img
          src="/assets/penny-bunny.png"
          alt="Penny’s bunny holding a coin purse"
        />
        <h3>A little home for your money.</h3>
        <p>
          Sign in for a membership that follows you. Your ledger stays on this
          device. You can enable cloud sync separately in Settings.
        </p>
      </div>
      {!supabase && (
        <div className="notice">
          <Icon name="info" />
          <p>
            Sign-in is waiting for the publisher’s setup. Device-only tracking
            works in this preview.
          </p>
        </div>
      )}
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        <span>
          I agree to the{" "}
          <button
            type="button"
            className="inline-link"
            onClick={() => onLegal("terms")}
          >
            Terms
          </button>{" "}
          and have read the{" "}
          <button
            type="button"
            className="inline-link"
            onClick={() => onLegal("privacy")}
          >
            Privacy Policy
          </button>
          .
        </span>
      </label>
      <button
        className="button secondary full"
        disabled={busy || !accepted}
        onClick={() => {
          void run(googleLogin);
        }}
      >
        <Icon name="google" />
        Continue with Google
      </button>
      <div className="divider">
        <span>or with your email</span>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <label>
          Email address
          <input
            type="email"
            value={email}
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={sent}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {sent && (
          <>
            <p className="muted">Check your inbox. Tap the sign-in link, or enter a code if your email includes one.</p>
            <label>
              One-time code · if provided
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                minLength={6}
                maxLength={8}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          </>
        )}
        <button className="button primary full" disabled={busy || !accepted || (sent && code.length < 6)}>
          {busy
            ? "Just a moment…"
            : sent
              ? "Confirm code"
              : "Email me a sign-in link"}
        </button>
        {sent && (
          <div className="auth-email-actions">
            <button className="text-button" type="button" disabled={busy || cooldown > 0} onClick={() => {
              void run(async () => { await sendCode(email); setCooldown(60); });
            }}>{cooldown ? `Resend in ${cooldown}s` : "Resend email"}</button>
            <button className="text-button" type="button" onClick={() => {
              setSent(false);
              setCode("");
              setCooldown(0);
            }}>Different email</button>
          </div>
        )}
      </form>
      <small className="center">New to Penny? Your account is created after you verify your email.</small>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <small className="center">
        No ads. No selling your spending data. Just a little peace of mind.
      </small>
    </div>
  );
}
