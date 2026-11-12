import type { OrderStatus, Prisma } from "@prisma/client";
import { parseMeta } from "@/lib/services";

/**
 * One reading of an order for the customer, shared by "My orders" and the order page, so both show the same
 * status word, progress, refill and cancel state.
 */
export type Look = "run" | "done" | "partial" | "cancel" | "wait";
export const LOOK: Record<Look, [bg: string, fg: string, bar: string]> = {
  run: ["#DBEAFE", "#1E40AF", "#2563EB"],
  done: ["#DCFCE7", "#166534", "#16A34A"],
  partial: ["#FEF3C7", "#92400E", "#D97706"],
  cancel: ["#FEE2E2", "#991B1B", "#DC2626"],
  wait: ["#F1F5F9", "#334155", "#94A3B8"],
};
/** Key in the "ordersUi" messages for each look. */
export const LOOK_LABEL: Record<Look, string> = { run: "running", done: "done", partial: "partial", wait: "waiting", cancel: "canceled" };

const lookOf = (s: OrderStatus): Look =>
  s === "FULFILLED" ? "done" : s === "PAID" || s === "PROCESSING" ? "run" : s === "AWAITING_PAYMENT" || s === "PAYMENT_REVIEW" ? "wait" : "cancel";

/** What to load on each order line (the provider attempt that counts: the latest one not closed). */
export const summaryItemInclude = {
  supplierOrders: {
    where: { status: { not: "CLOSED" } },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { startCount: true, remains: true, refundedPartial: true, refillAt: true, refillStatus: true, supplierOrderId: true, cancelAt: true },
  },
} satisfies Prisma.OrderItemInclude;

type SO = { startCount: number | null; remains: number | null; refundedPartial: number | null; refillAt: Date | null; refillStatus: string | null; cancelAt: Date | null };
type Line = { status: string; fieldValues: Prisma.JsonValue; supplierOrders: SO[]; variant: { service: Prisma.JsonValue } };
type O = { status: OrderStatus; fulfilledAt: Date | null; items: Line[] };

const qtyOf = (i: Line) => Number(((i.fieldValues ?? {}) as Record<string, string>).quantity) || 0;

export function lineDone(i: Line) {
  const q = qtyOf(i);
  const s0 = i.supplierOrders[0];
  if (i.status === "DELIVERED") return s0?.remains != null ? Math.max(0, q - s0.remains) : q;
  if (i.status === "FAILED") return 0;
  return s0?.remains != null ? Math.max(0, Math.min(q, q - s0.remains)) : 0;
}

export function orderSummary(o: O, now = new Date()) {
  const item = o.items[0];
  const fv = (item?.fieldValues ?? {}) as Record<string, string>;
  const pack = o.items.length > 1 && fv.packName ? (JSON.parse(fv.packName) as Record<string, string>) : null;
  const meta = parseMeta(item?.variant.service);
  const qty = o.items.reduce((a, i) => a + qtyOf(i), 0);
  const so = item?.supplierOrders[0];
  const refundedPart = o.items.reduce((a, i) => a + (i.supplierOrders[0]?.refundedPartial ?? 0), 0);
  const look: Look = refundedPart > 0 && o.status === "FULFILLED" ? "partial" : lookOf(o.status);
  // Real progress from the provider when known (quantity − remains), otherwise a small "started" bar.
  const done = look === "done" ? qty : o.items.reduce((a, i) => a + lineDone(i), 0);
  const pct = look === "done" ? 100 : qty && done ? Math.round((done / qty) * 100) : look === "run" ? 8 : 0;
  // Refill: only inside the refill period (from delivery), once a day, and not while one is running.
  const refillUntil = meta?.refillDays && o.fulfilledAt ? new Date(o.fulfilledAt.getTime() + meta.refillDays * 86_400_000) : null;
  const refillOpen = !!so?.refillAt && !["Completed", "Rejected", "Canceled", "Error"].includes(so.refillStatus ?? "");
  const refill: "none" | "over" | "running" | "wait" | "open" = !refillUntil ? "none" : now > refillUntil ? "over"
    : refillOpen && now.getTime() - so!.refillAt!.getTime() < 3 * 86_400_000 ? "running"
    : so?.refillAt && now.getTime() - so.refillAt.getTime() < 86_400_000 ? "wait" : "open";
  const canCancel = look === "run" && meta?.info?.cancel !== false;
  const cancelAsked = o.items.some((i) => !!i.supplierOrders[0]?.cancelAt);
  return { pack, meta, qty, done, pct, look, refundedPart, refill, refillUntil, startCount: !pack && so?.startCount != null ? so.startCount : null, canCancel, cancelAsked, fv };
}
