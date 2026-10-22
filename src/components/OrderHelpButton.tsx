"use client";
import { useState, useTransition } from "react";
import { requestOrderHelp } from "@/actions/customer";

/** "Refill" / "Mande anile" on My orders: sends the request to staff (a support ticket linked to the order). */
export function OrderHelpButton({ orderId, kind, label, done, className, children }: { orderId: string; kind: "refill" | "cancel"; label: string; done: string; className: string; children?: React.ReactNode }) {
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  if (sent) return <p className="rounded-[10px] bg-[#DCFCE7] px-3 py-2.5 text-xs text-[#166534]">{done}</p>;
  return (
    <button type="button" disabled={pending} className={className} onClick={() => start(async () => { const r = await requestOrderHelp(orderId, kind); if (r.ok) setSent(true); })}>
      {children}
      {label}
    </button>
  );
}
