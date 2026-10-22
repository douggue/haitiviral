"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BellIcon } from "./Icons";
import { pushPublicKey, removePushSubscription, savePushSubscription } from "@/actions/push";
import { isIos, isStandalone } from "@/lib/pwa-client";

type State = "loading" | "unsupported" | "ios" | "denied" | "off" | "on";

function keyBytes(base64: string) {
  const b = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
}

/** "Notifications on this phone": Web Push for payments, codes and deliveries. On iPhone it works once the app is installed. */
export function PushToggle() {
  const t = useTranslations("pwa");
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState(isIos() && !isStandalone() ? "ios" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      if (sub) {
        setState("on");
        // Keep this device linked to the account that's signed in now.
        void savePushSubscription(sub.toJSON(), false);
      } else setState("off");
    })().catch(() => setState("off"));
  }, []);

  const enable = async () => {
    setBusy(true);
    setError("");
    try {
      // Asked first, straight from the tap (iPhone requires it).
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(await pushPublicKey()) }));
      const r = await savePushSubscription(sub.toJSON());
      if (!r.ok) throw new Error(r.error);
      setState("on");
    } catch {
      setError(t("pushError"));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return null;
  return (
    <section className="card p-5" aria-labelledby="push-title">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><BellIcon /></span>
        <div className="min-w-0 flex-1">
          <h2 id="push-title" className="font-semibold">{t("pushTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{t("pushBody")}</p>
        </div>
      </div>
      <div className="mt-4">
        {state === "on" && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-success" role="status">{t("pushOn")}</span>
            <button type="button" onClick={disable} disabled={busy} className="btn-secondary min-h-10">{t("pushDisable")}</button>
          </div>
        )}
        {state === "off" && <button type="button" onClick={enable} disabled={busy} className="btn-primary min-h-11">{t("pushEnable")}</button>}
        {state === "denied" && <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm">{t("pushDenied")}</p>}
        {state === "ios" && <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm">{t("pushIos")}</p>}
        {state === "unsupported" && <p className="text-sm text-muted">{t("pushUnsupported")}</p>}
        {error && <p className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{error}</p>}
      </div>
    </section>
  );
}
