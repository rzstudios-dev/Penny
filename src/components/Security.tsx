import { useEffect, useState } from "react";
import { authenticateBiometric, biometricAvailable, clearPin, loadSecurity, setBiometric, setPin, verifyPin, type SecurityConfig } from "../lib/security";
import Icon from "./Icon";

export function PinSetup({ onDone }: { onDone?: () => void }) {
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [pin, setPinValue] = useState("");
  const [repeat, setRepeat] = useState("");
  const [current, setCurrent] = useState("");
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void loadSecurity().then(setConfig); void biometricAvailable().then(setAvailable); }, []);
  async function save() {
    try {
      if (config && !(await verifyPin(current, config))) throw new Error("Enter your current PIN first.");
      if (pin !== repeat) throw new Error("Those PINs do not match.");
      await setPin(pin);
      setConfig(await loadSecurity()); setPinValue(""); setRepeat(""); setCurrent(""); setError(""); onDone?.();
    } catch (caught) { setError((caught as Error).message); }
  }
  return <div className="form-stack security-settings">
    <p className="muted">A Penny PIN locks the app and protects transaction deletion on this device.</p>
    {config && <label>Current PIN<input type="password" inputMode="numeric" autoComplete="off" value={current} onChange={(event) => setCurrent(event.target.value.replace(/\D/g, ""))} maxLength={12} /></label>}
    <label>{config ? "New PIN" : "Create PIN"}<input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(event) => setPinValue(event.target.value.replace(/\D/g, ""))} minLength={6} maxLength={12} /></label>
    <label>Repeat PIN<input type="password" inputMode="numeric" autoComplete="off" value={repeat} onChange={(event) => setRepeat(event.target.value.replace(/\D/g, ""))} minLength={6} maxLength={12} /></label>
    <button type="button" className="button primary full" disabled={pin.length < 6 || repeat.length < 6} onClick={() => void save()}>{config ? "Change PIN" : "Set PIN"}</button>
    {config && available && <label className="toggle-row"><span><strong>Fingerprint or face unlock</strong><small>Use your device biometric, with Penny PIN as backup</small></span><input type="checkbox" role="switch" checked={config.biometric} onChange={(event) => void setBiometric(event.target.checked).then(() => loadSecurity().then(setConfig)).catch((caught) => setError(caught.message))} /></label>}
    {config && <button type="button" className="button secondary full" onClick={() => { void verifyPin(current, config).then(async (valid) => { if (!valid) throw new Error("Enter your current PIN first."); await clearPin(); setConfig(null); setCurrent(""); onDone?.(); }).catch((caught) => setError(caught.message)); }}>Turn off app lock</button>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}

export function SecurityPrompt({ config, onSuccess, title = "Unlock Penny" }: { config: SecurityConfig; onSuccess: () => void; title?: string }) {
  const [pin, setPinValue] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(false);
  useEffect(() => { if (config.biometric) void biometricAvailable().then(setAvailable); }, [config.biometric]);
  async function verify() {
    if (busy) return;
    setBusy(true);
    try {
      if (attempts >= 5) await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, (attempts - 4) * 5_000)));
      if (!(await verifyPin(pin, config))) { setAttempts((n) => n + 1); setError("That PIN didn't match."); setPinValue(""); return; }
      onSuccess();
    } finally { setBusy(false); }
  }
  return <div className="security-gate"><div className="security-gate-card"><span className="category-icon color-sage"><Icon name="lock" size={28} /></span><h1>{title}</h1><p>Your money stays private.</p><label>Penny PIN<input autoFocus type="password" inputMode="numeric" autoComplete="off" value={pin} maxLength={12} onChange={(event) => setPinValue(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") void verify(); }} /></label><button className="button primary full" disabled={busy || pin.length < 6} onClick={() => void verify()}>Unlock</button>{available && <button className="button secondary full" onClick={() => void authenticateBiometric().then((ok) => { if (ok) onSuccess(); }).catch(() => setError("Use your Penny PIN to continue."))}><Icon name="lock" size={18} /> Use fingerprint or face</button>}{error && <p role="alert" className="form-error">{error}</p>}</div></div>;
}
