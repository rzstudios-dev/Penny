import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  applyScheduledIncome,
  emptyLedger,
  type Entitlement,
  type Ledger,
} from "./model";
import {
  readSnapshot,
  writeSnapshot,
  removeSnapshot,
  type Snapshot,
} from "./storage";
import {
  supabase,
  loadCloud,
  saveCloud,
  getEntitlement,
  listenForDeepLinks,
} from "./cloud";
import { configureNotifications } from "./notifications";
import { restorePurchases } from "./billing";

export function usePenny() {
  const [user, setUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(!supabase);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [status, setStatus] = useState("Saved on this device");
  const [error, setError] = useState(""),
    [entitlement, setEntitlement] = useState<Entitlement>({
      active: false,
      expiresAt: null,
      everPremium: false,
    });
  const owner = "guest"; // Sign-in does not change or upload the device ledger.
  const current = useRef(snapshot),
    syncing = useRef(false),
    deleted = useRef(false),
    generation = useRef(0);
  current.current = snapshot;
  const refreshPremium = useCallback(async () => {
    if (!user) return;
    const capturedGeneration = generation.current;
    try {
      // Recover interrupted or newly completed payments on Android resume.
      const membership =
        Capacitor.getPlatform() === "android"
          ? await restorePurchases()
          : await getEntitlement();
      if (generation.current === capturedGeneration) setEntitlement(membership);
    } catch {
      /* Retain only an unexpired verified entitlement in memory. */
    }
  }, [user]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data, error: authError }) => {
      if (active) {
        setUser(data.session?.user || null);
        setAuthReady(true);
        if (authError) setError(authError.message);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setAuthReady(true);
      generation.current++;
    });
    let cleanup: (() => void) | undefined;
    void listenForDeepLinks().then((fn) => {
      if (!active) fn();
      else cleanup = fn;
    });
    return () => {
      active = false;
      subscription.unsubscribe();
      cleanup?.();
    };
  }, []);
  useEffect(() => {
    let active = true;
    void readSnapshot(owner)
      .then((local) => {
        const ledger = applyScheduledIncome(local.ledger);
        if (active)
          setSnapshot({
            ...local,
            ledger,
            pending: local.pending || ledger !== local.ledger,
          });
      })
      .catch((caught) => {
        if (active) setError((caught as Error).message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!authReady) return;
    setEntitlement({ active: false, expiresAt: null, everPremium: false });
    setSnapshot((s) =>
      s && s.ledger.settings.cloudSync && s.cloudOwner !== user?.id
        ? {
            ...s,
            ledger: {
              ...s.ledger,
              settings: { ...s.ledger.settings, cloudSync: false },
            },
            pending: false,
          }
        : s,
    );
    void refreshPremium();
  }, [user?.id, authReady, refreshPremium]);
  useEffect(() => {
    const checkScheduledIncome = () => {
      setSnapshot((s) => {
        if (!s) return s;
        const ledger = applyScheduledIncome(s.ledger);
        return ledger === s.ledger ? s : { ...s, ledger, pending: true };
      });
    };
    const onActive = () => {
      void refreshPremium();
      checkScheduledIncome();
    };
    window.addEventListener("focus", onActive);
    document.addEventListener("visibilitychange", checkScheduledIncome);
    const incomeTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") checkScheduledIncome();
    }, 60_000);
    let remove: (() => void) | undefined;
    if (Capacitor.isNativePlatform())
      void App.addListener("appStateChange", (state) => {
        if (state.isActive) onActive();
      }).then((h) => {
        remove = () => {
          void h.remove();
        };
      });
    return () => {
      window.removeEventListener("focus", onActive);
      document.removeEventListener("visibilitychange", checkScheduledIncome);
      window.clearInterval(incomeTimer);
      remove?.();
    };
  }, [refreshPremium]);
  useEffect(() => {
    if (!snapshot || deleted.current) return;
    const captured = snapshot,
      capturedGeneration = generation.current;
    void writeSnapshot(owner, captured).catch(() =>
      setError(
        "Your device storage is full. Export a backup before closing Penny.",
      ),
    );
    if (
      !authReady ||
      !user ||
      !snapshot.ledger.settings.cloudSync ||
      snapshot.cloudOwner !== user.id ||
      !snapshot.pending ||
      snapshot.ledger.demo
    ) {
      if (!snapshot.ledger.settings.cloudSync)
        setStatus("Saved on this device");
      return;
    }
    const timer = setTimeout(() => {
      if (syncing.current || generation.current !== capturedGeneration) return;
      syncing.current = true;
      setStatus("Saving to cloud…");
      void saveCloud(captured.ledger, captured.revision)
        .then((revision) => {
          if (generation.current !== capturedGeneration) return;
          setSnapshot((latest) =>
            latest
              ? {
                  ...latest,
                  revision,
                  pending: latest.ledger !== captured.ledger,
                }
              : latest,
          );
          setStatus("Cloud backup up to date");
        })
        .catch((caught) => {
          if (generation.current === capturedGeneration) {
            setStatus("Cloud backup needs attention");
            setError((caught as Error).message);
          }
        })
        .finally(() => {
          syncing.current = false;
        });
    }, 900);
    return () => clearTimeout(timer);
  }, [snapshot, user?.id, authReady]);
  useEffect(() => {
    if (snapshot && snapshot.ledger.accounts.length)
      void configureNotifications(
        snapshot.ledger.settings,
        entitlement.active,
        !!user,
      ).catch(() => {});
  }, [
    snapshot?.ledger.accounts.length,
    snapshot?.ledger.settings.reminders,
    snapshot?.ledger.settings.reminderHour,
    snapshot?.ledger.settings.premiumReminder,
    snapshot?.ledger.settings.loginReminder,
    user?.id,
    entitlement.active,
  ]);
  useEffect(() => {
    if (!entitlement.active || !entitlement.expiresAt) return;
    const remaining = new Date(entitlement.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      setEntitlement((e) => ({ ...e, active: false }));
      return;
    }
    const timer = setTimeout(
      () => {
        setEntitlement((e) => ({ ...e, active: false }));
        void refreshPremium();
      },
      Math.min(remaining, 2_000_000_000),
    );
    return () => clearTimeout(timer);
  }, [entitlement, refreshPremium]);
  const update = useCallback((updater: (ledger: Ledger) => Ledger) => {
    setSnapshot((s) =>
      s ? { ...s, ledger: updater(s.ledger), pending: true } : s,
    );
    setError("");
  }, []);
  const reset = useCallback(async (currency = "USD") => {
    generation.current++;
    deleted.current = true;
    await removeSnapshot(owner);
    setSnapshot({ ledger: emptyLedger(currency), revision: 0, pending: false });
    deleted.current = false;
    setStatus("Saved on this device");
  }, []);
  const enableCloud = useCallback(
    async (mode: "upload" | "download", remote: Snapshot | null) => {
      if (!user) throw new Error("Sign in before enabling cloud sync.");
      if (!current.current) return;
      if (syncing.current)
        throw new Error("A sync is finishing. Try again in a moment.");
      generation.current++;
      const source =
        mode === "download" && remote ? remote.ledger : current.current.ledger;
      if (source.demo)
        throw new Error(
          "Start your own ledger before enabling cloud sync. Sample data stays on this device.",
        );
      setSnapshot({
        ledger: {
          ...source,
          settings: { ...source.settings, cloudSync: true },
        },
        revision: remote?.revision || 0,
        cloudOwner: user.id,
        pending: true,
      });
    },
    [user],
  );
  const disableCloud = useCallback(() => {
    generation.current++;
    setSnapshot((s) =>
      s
        ? {
            ...s,
            ledger: {
              ...s.ledger,
              settings: { ...s.ledger.settings, cloudSync: false },
            },
            pending: false,
          }
        : s,
    );
    setStatus("Saved on this device");
  }, []);
  const reloadCloud = useCallback(async () => {
    if (!user) return;
    const remote = await loadCloud(user.id);
    if (remote) {
      await enableCloud("download", remote);
      setError("");
    }
  }, [user, enableCloud]);
  const deleteCloudCopy = useCallback(async () => {
    if (!user || !supabase)
      throw new Error("Sign in to delete your cloud copy.");
    if (syncing.current)
      throw new Error("A sync is finishing. Wait a moment and try again.");
    disableCloud();
    const { error: cloudError } = await supabase
      .from("penny_ledgers")
      .delete()
      .eq("user_id", user.id);
    if (cloudError) throw cloudError;
    setSnapshot((s) =>
      s ? { ...s, revision: 0, pending: false, cloudOwner: undefined } : s,
    );
  }, [user, disableCloud]);
  const retrySync = useCallback(() => {
    setSnapshot((s) => (s ? { ...s, pending: true } : s));
    setError("");
  }, []);
  return {
    ledger: snapshot?.ledger,
    user,
    owner,
    entitlement,
    setEntitlement,
    refreshPremium,
    update,
    reset,
    status,
    error,
    setError,
    reloadCloud,
    retrySync,
    enableCloud,
    disableCloud,
    deleteCloudCopy,
    loading: !snapshot || !authReady,
  };
}
