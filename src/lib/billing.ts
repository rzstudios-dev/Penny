import { Capacitor, registerPlugin } from "@capacitor/core";
import { requireCloud, getEntitlement } from "./cloud";
export interface PlayProduct {
  productId: string;
  title: string;
  price: string;
  offerToken: string;
  billingPeriod: string;
}
interface PlayBillingPlugin {
  getProduct(options: { productId: string }): Promise<PlayProduct>;
  purchase(options: {
    productId: string;
    offerToken: string;
    accountId: string;
  }): Promise<{ purchaseToken: string; productId: string; pending: boolean }>;
  restore(): Promise<{
    purchases: { purchaseToken: string; productId: string; pending: boolean }[];
  }>;
}
const PlayBilling = registerPlugin<PlayBillingPlugin>("PlayBilling");
export const productId =
  import.meta.env.VITE_PLAY_PRODUCT_ID || "penny_premium";
export async function redeemPremiumCode(code: string) {
  const cloud = requireCloud();
  const {
    data: { user },
    error: authError,
  } = await cloud.auth.getUser();
  if (authError || !user)
    throw new Error("Please sign in before redeeming a code.");
  const { data, error } = await cloud.functions.invoke("penny-redeem-premium", {
    body: { code: code.trim() },
  });
  if (error) {
    const body = await error.context?.json?.().catch(() => null);
    throw new Error(
      body?.error || "Code could not be redeemed. Please try again.",
    );
  }
  if (!data?.active || !data?.lifetime)
    throw new Error("Code could not be redeemed. Please try again.");
  const { data: session } = await cloud.auth.getSession();
  if (session.session?.user.id !== user.id)
    throw new Error(
      "Your sign-in changed. Please sign in again to view Premium.",
    );
  return { active: true, lifetime: true, expiresAt: null, everPremium: true };
}
export async function getProduct() {
  if (Capacitor.getPlatform() !== "android") return null;
  return PlayBilling.getProduct({ productId });
}
async function verifyPurchase(purchaseToken: string) {
  const { data, error } = await requireCloud().functions.invoke(
    "penny-verify-purchase",
    { body: { purchaseToken, productId } },
  );
  if (error || !data?.verified)
    throw new Error(
      "Your purchase is being verified. Use Restore purchase to try again.",
    );
  return getEntitlement();
}
export async function subscribe(product: PlayProduct) {
  if (Capacitor.getPlatform() !== "android")
    throw new Error(
      "Subscriptions are available in the Android app through Google Play. This browser preview cannot charge you.",
    );
  const {
    data: { user },
    error,
  } = await requireCloud().auth.getUser();
  if (error || !user)
    throw new Error(
      "Please sign in before subscribing, so your membership can be restored.",
    );
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(user.id)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  const purchase = await PlayBilling.purchase({
    productId,
    offerToken: product.offerToken,
    accountId: hash,
  });
  if (purchase.pending)
    throw new Error(
      "Your payment is pending. Premium will unlock after Google Play confirms it.",
    );
  return verifyPurchase(purchase.purchaseToken);
}
export async function restorePurchases() {
  if (Capacitor.getPlatform() !== "android")
    throw new Error("Open Penny on Android to restore a Google Play purchase.");
  const {
    data: { user },
  } = await requireCloud().auth.getUser();
  if (!user) throw new Error("Please sign in first.");
  const membership = await getEntitlement();
  if (membership.lifetime) return membership;
  const { purchases } = await PlayBilling.restore();
  const valid = purchases.filter(
    (p) => p.productId === productId && !p.pending,
  );
  for (const purchase of valid) await verifyPurchase(purchase.purchaseToken);
  return getEntitlement();
}
