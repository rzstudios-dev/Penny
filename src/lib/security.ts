import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

type NativeSecurity = {
  availability(): Promise<{ available: boolean }>;
  authenticate(): Promise<{ authenticated: boolean }>;
};
const nativeSecurity = registerPlugin<NativeSecurity>("PennySecurity");
const key = "penny:device-lock:v1";
export type SecurityConfig = { salt: string; digest: string; biometric: boolean };

async function digest(pin: string, salt: string) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: Uint8Array.from(salt.match(/../g)!.map((part) => parseInt(part, 16))), iterations: 210_000 }, material, 256);
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function loadSecurity(): Promise<SecurityConfig | null> {
  const raw = Capacitor.isNativePlatform() ? (await Preferences.get({ key })).value : localStorage.getItem(key);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (typeof value.salt !== "string" || typeof value.digest !== "string") return null;
  return { salt: value.salt, digest: value.digest, biometric: !!value.biometric };
}
async function saveSecurity(value: SecurityConfig | null) {
  if (Capacitor.isNativePlatform()) {
    if (value) await Preferences.set({ key, value: JSON.stringify(value) });
    else await Preferences.remove({ key });
  } else if (value) localStorage.setItem(key, JSON.stringify(value));
  else localStorage.removeItem(key);
  window.dispatchEvent(new Event("penny-security-change"));
}
export async function setPin(pin: string) {
  if (!/^\d{6,12}$/.test(pin)) throw new Error("Use a PIN with 6 to 12 digits.");
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  await saveSecurity({ salt, digest: await digest(pin, salt), biometric: false });
}
export async function verifyPin(pin: string, config: SecurityConfig) {
  if (!/^\d{6,12}$/.test(pin)) return false;
  const candidate = await digest(pin, config.salt);
  let difference = 0;
  for (let i = 0; i < candidate.length; i++) difference |= candidate.charCodeAt(i) ^ config.digest.charCodeAt(i);
  return difference === 0;
}
export async function clearPin() { await saveSecurity(null); }
export async function biometricAvailable() {
  if (Capacitor.getPlatform() !== "android") return false;
  try { return (await nativeSecurity.availability()).available; } catch { return false; }
}
export async function setBiometric(enabled: boolean) {
  const config = await loadSecurity();
  if (!config) throw new Error("Create a Penny PIN first.");
  if (enabled && !(await biometricAvailable())) throw new Error("Fingerprint or face unlock is not available on this device.");
  await saveSecurity({ ...config, biometric: enabled });
}
export async function authenticateBiometric() { return (await nativeSecurity.authenticate()).authenticated; }
