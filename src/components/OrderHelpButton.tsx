"use client";
import { safeCall } from "@/lib/safe-call";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { requestOrderHelp } from "@/actions/customer";

/**
 * "Refill" / "Mande anile" on My orders and the order page: sent to the provider when the order is linked to one,
 * otherwise to staff (a ticket). Cancel asks "Ou sèten?" first, and once asked it shows "request sent" instead
 * of the button (also after a reload, with `requested`).
 */
export function OrderHelpButton({ orderId, kind, label, className, children, requested }: { orderId: string; kind: "refill" | "cancel"; label: string; className: string; children?: React.ReactNode; requested?: boolean }) {
  const t = useTranslations("ordersUi");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(requested ? { ok: true, text: t("cancelPending") } : null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  if (note?.ok) return <p role="status" className="flex-1 rounded-[10px] bg-[#DCFCE7] px-3 py-2.5 text-xs text-[#166534]">{note.text}</p>;
  const send = () =>
    start(async () => {
      const r = await safeCall(() => requestOrderHelp(orderId, kind));
      setConfirming(false);
      if (r.ok) setNote({ ok: true, text: r.how === "ticket" ? t("requested") : kind === "refill" ? t("refillSent") : t("cancelSent") });
      else setNote({ ok: false, text: r.error === "expired" ? t("refillExpired") : r.error === "too_soon" ? t("refillTooSoon") : r.error === "network" ? t("helpNetwork") : t("helpError") });
    });
  if (confirming) {
    return (
      <div className="flex flex-1 flex-col gap-2 rounded-xl border border-[#FCA5A5] bg-surface p-3">
        <p className="text-sm font-bold">{t("cancelSure")}</p>
        <p className="text-xs text-muted">{t("cancelSureBody")}</p>
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="min-h-11 flex-1 rounded-xl border border-border bg-surface text-sm font-bold">{t("cancelNo")}</button>
          <button type="button" disabled={pending} onClick={send} className="min-h-11 flex-1 rounded-xl bg-[#B91C1C] text-sm font-bold text-white disabled:opacity-60">{pending ? t("sending") : t("cancelYes")}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <button type="button" disabled={pending} className={`${className} disabled:opacity-60`} onClick={() => (kind === "cancel" ? setConfirming(true) : send())}>
        {children}
        {pending ? t("sending") : label}
      </button>
      {note && <p role="alert" className="text-xs text-[#B91C1C]">{note.text}</p>}
    </div>
  );
}
