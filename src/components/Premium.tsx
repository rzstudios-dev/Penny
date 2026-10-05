import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  getProduct,
  restorePurchases,
  subscribe,
  productId,
  redeemPremiumCode,
  type PlayProduct,
} from "../lib/billing";
import type { Entitlement } from "../lib/model";
import Icon from "./Icon";
export default function Premium({
  entitlement,
  signedIn,
  onLogin,
  onChange,
  onLegal,
}: {
  entitlement: Entitlement;
  signedIn: boolean;
  onLogin: () => void;
  onChange: (e: Entitlement) => void;
  onLegal: (page: "terms" | "privacy") => void;
}) {
  const [product, setProduct] = useState<PlayProduct | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState("");
  useEffect(() => {
    void getProduct()
      .then(setProduct)
      .catch(() =>
        setError("Subscription unavailable. Please try again later."),
      );
  }, []);
  async function checkout(restore = false) {
    if (!signedIn) {
      onLogin();
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!restore && !product)
        throw new Error(
          "Subscribe from the Android app once Google Play checkout is available.",
        );
      const result = restore
        ? await restorePurchases()
        : await subscribe(product!);
      onChange(result);
      if (restore && !result.active) setError("No active subscription found.");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    if (!signedIn) {
      onLogin();
      return;
    }
    setBusy(true);
    setError("");
    try {
      onChange(await redeemPremiumCode(code));
      setCode("");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="premium-page premium-redesign">
      <div className="premium-intro">
        <div>
          <h2>Room for every goal.</h2>
          <p>More possibilities for your pennies.</p>
        </div>
        <img src="/assets/penny-bunny-small.png" alt="Penny bunny" />
      </div>
      <div className="premium-offer">
        {entitlement.active ? (
          <div className="premium-owned">
            <Icon name="success" size={28} />
            <h3>
              {entitlement.lifetime
                ? "Lifetime Premium is yours"
                : "Your Premium is active"}
            </h3>
            <p>All your extra features are unlocked.</p>
          </div>
        ) : (
          <>
            <div className="premium-offer-kicker"><Icon name="sparkle" size={16} /> THE FULL PENNY EXPERIENCE</div>
            <div className="premium-offer-price">
              <div>
                <strong>{product?.price || "$5"}</strong>
                <span> / month</span>
              </div>
              <span className="premium-price-seal"><Icon name="crown" size={27} /></span>
            </div>
            {!product && (
              <small className="premium-local-price">
                USD target · local price at checkout
              </small>
            )}
            <button
              className="button premium-buy full"
              disabled={
                busy ||
                (signedIn && Capacitor.getPlatform() === "android" && !product)
              }
              onClick={() => {
                void checkout();
              }}
            >
              <Icon name="crown" size={21} />
              {busy
                ? "Just a moment…"
                : signedIn
                  ? "Subscribe to Premium"
                  : "Sign in to get Premium"}
              <Icon name="arrow" size={19} />
            </button>
            <p className="premium-offer-note">Google Play subscription · No trial · Cancel anytime</p>
          </>
        )}
      </div>
      <div className="premium-perks" aria-label="Premium features">
        {[
          ["basket", "Unlimited envelopes"],
          ["wallet", "Unlimited wallets"],
          ["flower", "40 playful icons"],
          ["report", "Deeper reports"],
        ].map(([icon, title]) => (
          <div key={title}><span><Icon name={icon} size={21} /></span><strong>{title}</strong></div>
        ))}
      </div>
      <p className="premium-free-line">Free includes 10 envelopes, 1 wallet & basic reports.</p>
      {!entitlement.lifetime && (
        <form className="premium-redeem" onSubmit={redeem}>
          <div className="premium-code-input">
            <Icon name="gift" size={21} />
            <input
              aria-label="Premium code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              maxLength={128}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Premium code"
            />
            <button
              type="submit"
              className="icon-button"
              disabled={busy}
              aria-label={signedIn ? "Redeem code" : "Sign in to redeem"}
              title={signedIn ? "Redeem code" : "Sign in to redeem"}
            >
              <Icon name={busy ? "time" : "arrow"} size={21} />
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="premium-meta-row">
        <details className="premium-details">
          <summary>Membership details</summary>
          <p>{entitlement.lifetime
            ? "Lifetime access has no renewal. Cancel any existing Play subscription separately."
            : "Renews monthly until canceled in Google Play. Final price and taxes appear before payment. Deleting your account does not cancel billing."}</p>
        </details>
        <div className="premium-legal-links">
          <button className="inline-link" onClick={() => onLegal("terms")}>
            Terms
          </button>
          <button className="inline-link" onClick={() => onLegal("privacy")}>
            Privacy
          </button>
        </div>
      </div>
      <div className="premium-support-actions">
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            void checkout(true);
          }}
        >
          Restore purchase
        </button>
        <a
          className="text-button"
          href={
            "https://play.google.com/store/account/subscriptions?sku=" +
            encodeURIComponent(productId) +
            "&package=app.penny.expenses"
          }
          target="_blank"
          rel="noreferrer"
        >
          Manage subscription
        </a>
      </div>
    </section>
  );
}
