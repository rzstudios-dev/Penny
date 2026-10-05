import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Preferences } from "@capacitor/preferences";
import { parseLedger, type Ledger, type Entitlement } from "./model";
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const nativeStorage = {
  getItem: async (key: string) => (await Preferences.get({ key })).value,
  setItem: async (key: string, value: string) => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string) => {
    await Preferences.remove({ key });
  },
};
export const supabase =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          flowType: "pkce",
          storage: Capacitor.isNativePlatform() ? nativeStorage : undefined,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: !Capacitor.isNativePlatform(),
        },
      })
    : null;
export const requireCloud = () => {
  if (!supabase)
    throw new Error(
      "Sign-in is not available in this preview. The publisher needs to connect Penny’s authentication service. You can still use Penny on this device.",
    );
  return supabase;
};
export async function googleLogin() {
  const client = requireCloud();
  const native = Capacitor.isNativePlatform();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: native
        ? "app.penny.expenses://auth/callback"
        : location.origin,
      skipBrowserRedirect: native,
    },
  });
  if (error) throw error;
  if (native && data.url) await Browser.open({ url: data.url });
}
export async function sendCode(email: string) {
  const { error } = await requireCloud().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: Capacitor.isNativePlatform()
        ? "app.penny.expenses://auth/callback"
        : location.origin,
    },
  });
  if (error) throw error;
}
export async function verifyCode(email: string, token: string) {
  const { data, error } = await requireCloud().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw error;
  if (!data.session?.user) throw new Error("Sign-in did not finish. Please try again.");
}
export async function listenForDeepLinks() {
  if (!Capacitor.isNativePlatform() || !supabase) return () => {};
  const handle = async (url: string) => {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "app.penny.expenses:" ||
      parsed.hostname !== "auth" ||
      parsed.pathname !== "/callback"
    )
      return;
    const code = parsed.searchParams.get("code");
    const tokenHash = parsed.searchParams.get("token_hash");
    const authError = parsed.searchParams.get("error_description");
    if (authError) {
      window.dispatchEvent(new CustomEvent("penny-auth-error", { detail: authError }));
      await Browser.close().catch(() => {});
      return;
    }
    if (code || tokenHash) {
      const { error } = code
        ? await supabase!.auth.exchangeCodeForSession(code)
        : await supabase!.auth.verifyOtp({ token_hash: tokenHash!, type: "email" });
      if (error)
        window.dispatchEvent(
          new CustomEvent("penny-auth-error", { detail: error.message }),
        );
      await Browser.close().catch(() => {});
    }
  };
  const listener = await App.addListener("appUrlOpen", (event) => {
    void handle(event.url).catch(() =>
      window.dispatchEvent(
        new CustomEvent("penny-auth-error", {
          detail: "Sign-in did not finish. Please try again.",
        }),
      ),
    );
  });
  const launch = await App.getLaunchUrl();
  if (launch) await handle(launch.url);
  return () => {
    void listener.remove();
  };
}
export async function loadCloud(userId: string) {
  const { data, error } = await requireCloud()
    .from("penny_ledgers")
    .select("data, revision")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        ledger: parseLedger(data.data),
        revision: data.revision as number,
        pending: false,
      }
    : null;
}
export async function saveCloud(ledger: Ledger, expectedRevision: number) {
  if (ledger.demo)
    throw new Error(
      "Sample data cannot be synced. Start your own ledger first.",
    );
  const { data, error } = await requireCloud().rpc("penny_save_ledger", {
    ledger_data: ledger,
    expected_revision: expectedRevision,
  });
  if (error)
    throw new Error(
      error.message.includes("CONFLICT")
        ? "Another device has newer changes. Export your local backup, then use “Reload cloud data” in Settings."
        : error.message,
    );
  return Number(data);
}
export async function getEntitlement(): Promise<Entitlement> {
  if (!supabase) return { active: false, expiresAt: null, everPremium: false };
  const { data, error } = await supabase.functions.invoke("penny-premium-status");
  if (error) throw error;
  return {
    active: !!data.active,
    expiresAt: data.expiresAt,
    everPremium: !!data.everPremium,
    lifetime: !!data.lifetime,
  };
}
export async function deleteCloudAccount() {
  const { error } = await requireCloud().functions.invoke("penny-delete-account", {
    body: { confirm: "DELETE" },
  });
  if (error)
    throw new Error(
      "Account deletion could not be completed. Check your connection and try again.",
    );
  await requireCloud().auth.signOut({ scope: "local" });
}
