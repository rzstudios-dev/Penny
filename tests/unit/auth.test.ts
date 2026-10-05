import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  native: false,
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  listener: null as null | ((event: { url: string }) => void),
  openBrowser: vi.fn(),
  closeBrowser: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: {
    signInWithOtp: mocks.signInWithOtp,
    verifyOtp: mocks.verifyOtp,
    signInWithOAuth: mocks.signInWithOAuth,
    exchangeCodeForSession: mocks.exchangeCodeForSession,
  } }),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => mocks.native } }));
vi.mock("@capacitor/app", () => ({ App: {
  addListener: async (_event: string, callback: (event: { url: string }) => void) => {
    mocks.listener = callback;
    return { remove: vi.fn() };
  },
  getLaunchUrl: async () => null,
} }));
vi.mock("@capacitor/browser", () => ({ Browser: { open: mocks.openBrowser, close: mocks.closeBrowser } }));

vi.stubEnv("VITE_SUPABASE_URL", "https://penny-test.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
vi.stubGlobal("location", { origin: "https://penny.example" });
const { googleLogin, sendCode, verifyCode, listenForDeepLinks } = await import("../../src/lib/cloud");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.native = false;
  mocks.listener = null;
  mocks.signInWithOtp.mockResolvedValue({ data: { user: null, session: null }, error: null });
  mocks.verifyOtp.mockResolvedValue({ data: { session: { user: { id: "new-user" } } }, error: null });
  mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: { user: { id: "new-user" } } }, error: null });
  mocks.signInWithOAuth.mockResolvedValue({ data: { url: "https://auth.example/authorize" }, error: null });
  mocks.openBrowser.mockResolvedValue(undefined);
  mocks.closeBrowser.mockResolvedValue(undefined);
});

describe("email sign-in", () => {
  it("allows account creation and a web sign-in link for a new email", async () => {
    await sendCode("  NEW@Example.COM  ");
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "new@example.com",
      options: { shouldCreateUser: true, emailRedirectTo: "https://penny.example" },
    });
    await verifyCode("NEW@Example.COM", "123456");
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ email: "new@example.com", token: "123456", type: "email" });
  });

  it("rejects a verification response without a session", async () => {
    mocks.verifyOtp.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(verifyCode("hello@example.com", "123456")).rejects.toThrow("Sign-in did not finish");
  });

  it("accepts a native email callback with a PKCE code", async () => {
    mocks.native = true;
    await sendCode("hello@example.com");
    expect(mocks.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({
      options: { shouldCreateUser: true, emailRedirectTo: "app.penny.expenses://auth/callback" },
    }));
    const cleanup = await listenForDeepLinks();
    mocks.listener?.({ url: "app.penny.expenses://auth/callback?code=auth-code" });
    await vi.waitFor(() => expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("auth-code"));
    cleanup();
  });

  it("opens Google sign-in with the Android app callback", async () => {
    mocks.native = true;
    await googleLogin();
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "app.penny.expenses://auth/callback", skipBrowserRedirect: true },
    });
    expect(mocks.openBrowser).toHaveBeenCalledWith({ url: "https://auth.example/authorize" });
  });
});
