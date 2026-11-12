"use client";
import { useEffect, useState } from "react";
import { pushPublicKey, removePushSubscription, savePushSubscription } from "@/actions/push";

function keyBytes(base64: string) {
  const b = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "ios" | "denied" | "off" | "on";

/**
 * "Alerts on this phone" for staff: new deposits, tickets, withdrawals, trials, stuck orders, low provider balance.
 * Same Web Push as customers (on iPhone: add the site to the home screen first, then open the admin from there).
 */
export function AdminPushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches;
        return setState(ios ? "ios" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("off"));
  }, []);

  const enable = async () => {
    setBusy(true);
    setMsg("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(await pushPublicKey()) }));
      const r = await savePushSubscription(sub.toJSON());
      if (!r.ok) throw new Error(r.error);
      setState("on");
      setMsg("Alerts on. A test alert was sent.");
    } catch {
      setMsg("Could not turn alerts on. Try again.");
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
      setMsg("");
    } finally {
      setBusy(false);
    }
  };

  const base = "inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-bold";
  if (state === "loading" || state === "unsupported") return null;
  if (state === "ios") return <span className="max-w-[260px] text-xs text-muted">For alerts on iPhone: Share → Add to Home Screen, then open the admin from that icon.</span>;
  if (state === "denied") return <span className="max-w-[260px] text-xs text-muted">Alerts are blocked for this site in the phone&apos;s settings.</span>;
  return (
    <span className="flex flex-col gap-1">
      {state === "on" ? (
        <button type="button" disabled={busy} onClick={disable} className={`${base} border border-[#BBF7D0] bg-[#DCFCE7] text-[#166534]`}>🔔 Alerts on (tap to turn off)</button>
      ) : (
        <button type="button" disabled={busy} onClick={enable} className={`${base} border border-[#CBD2E1] bg-surface text-text dark:border-border`}>🔔 Turn on alerts on this phone</button>
      )}
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}
