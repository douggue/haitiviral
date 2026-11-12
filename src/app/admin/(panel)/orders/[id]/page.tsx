import { siteUrl } from "@/lib/site-url";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { itemTitle } from "@/lib/orders";
import { deliverItem, refundLine, refundOrder, revealOrderCodes, runFulfillment } from "@/actions/admin";
import { supplierOrderAction } from "@/actions/suppliers";
import { haitiDate, methodLabel, statusLabel } from "@/lib/admin-labels";
import { ActionButton } from "@/components/admin/ActionButton";
import { RevealCodes } from "@/components/admin/RevealCodes";
import { StatusBadge } from "@/components/StatusBadge";
import { PageTitle } from "@/components/admin/ui";
import { formatPhone, waNumber } from "@/lib/phone";
import { Avatar } from "@/components/Avatar";

export const metadata = { title: "Order" };


/** Readable names for what the order line stores; technical keys are not shown. */
const FIELD_LABELS: Record<string, string> = {
  link: "Link", quantity: "Quantity", comments: "Comments", username: "Comment author", durationMin: "Live minutes", require: "Customer gave",
  amountUsd: "Amount to send (USD)", feeUsd: "Fee charged (USD)", rate: "Rate used (HTG per USD)",
};
const HIDDEN = new Set(["publicConfirmedAt", "riskAcceptedAt", "termsAcceptedAt", "trial", "packName", "pack", "warrantyHours"]);
function fieldText(k: string, v: string) {
  if (k === "drip") {
    const m = /^(\d+)x(\d+)\/(\d+)min$/.exec(v);
    return ["Drip-feed", m ? `${m[1]} batches of ${Number(m[2]).toLocaleString("en-US")}, every ${m[3]} min` : v] as const;
  }
  if (k === "quantity") return ["Quantity", Number(v).toLocaleString("en-US")] as const;
  return [FIELD_LABELS[k] ?? k, v] as const;
}
const SO_OPEN = ["QUEUED", "SENDING", "PENDING", "UNKNOWN"];
export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("orders.view");
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: true,
      items: { include: { variant: { include: { product: true } }, _count: { select: { codes: true } }, supplierOrders: { orderBy: { createdAt: "asc" }, include: { supplier: { select: { id: true, name: true } } } } } },
      events: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      riskFlags: true,
    },
  });
  if (!order) notFound();
  const manage = can(staff, "orders.manage");
  // Money: what the customer paid, what went back, what the providers charged.
  const refunded = order.events.length ? (await prisma.ledgerEntry.aggregate({ where: { amount: { gt: 0 }, transaction: { type: "REFUND", metadata: { path: ["orderId"], equals: order.id } }, account: { userId: order.userId } }, _sum: { amount: true } }))._sum.amount ?? 0 : 0;
  const sos = order.items.flatMap((i) => i.supplierOrders);
  const cost = sos.reduce((a, x) => a + (x.status === "FAILED" || x.status === "CLOSED" ? 0 : x.costHtg ?? 0), 0);
  const costKnown = sos.some((x) => x.costHtg != null);
  const kept = order.status === "REFUNDED" || order.status === "CANCELED" ? 0 : order.total - refunded;

  return (
    <>
      <PageTitle
        title={<span className="flex flex-wrap items-center gap-2">Order #{order.number} <StatusBadge status={order.status} label={statusLabel(order.status)} /></span>}
        sub={`${haitiDate(order.createdAt)} (Haiti) · ${methodLabel(order.paymentMethod)}`}
      />
      <section className="card mb-4 grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
        {[
          ["Customer paid", order.total === 0 ? "Free" : formatMoney(order.total, order.currency, "en")],
          ["Given back", refunded ? formatMoney(refunded, order.currency, "en") : "—"],
          ["Provider cost", costKnown ? formatMoney(cost, "HTG", "en") : "Not known"],
          ["Profit", costKnown ? formatMoney(kept - cost, "HTG", "en") : "—"],
        ].map(([k, v]) => <div key={k}><p className="text-xs text-muted">{k}</p><p className="font-bold tabular-nums">{v}</p></div>)}
      </section>
      {order.riskFlags.filter((f) => f.status === "OPEN").map((f) => (
        <p key={f.id} className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">Risk flag: {f.reason} — <Link href="/admin/risk" className="underline">review</Link></p>
      ))}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <section className="card divide-y divide-border">
            {order.items.map((i) => (
              <div key={i.id} className="space-y-2 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{itemTitle(i, "en")}{i.quantity > 1 ? ` × ${i.quantity}` : ""}</p>
                  <StatusBadge status={i.status} label={statusLabel(i.status)} />
                </div>
                <p className="text-xs text-muted">{i.variant.product.fulfillmentType === "SUPPLIER_API" ? "Sent to a provider" : i.variant.product.fulfillmentType === "MANUAL" ? "Delivered by hand" : "From own stock"} · {formatMoney(i.unitPrice * i.quantity, order.currency, "en")}{i._count.codes ? ` · ${i._count.codes} account/code line(s) delivered` : ""}</p>
                {Object.entries(i.fieldValues as Record<string, string>).filter(([k]) => !HIDDEN.has(k)).map(([k, v]) => {
                  const [label, text] = fieldText(k, v);
                  return <p key={k} className="text-sm"><span className="text-muted">{label}:</span> <span className="break-all font-semibold">{k === "link" ? <a href={v} target="_blank" rel="noopener noreferrer" className="text-primary">{v}</a> : text}</span></p>;
                })}
                {i.deliveryNote && <p className="rounded-lg bg-surface-2 p-3 text-sm">{i.deliveryNote}</p>}
                {i.supplierOrders.map((so) => (
                  <div key={so.id} className="space-y-2 rounded-lg bg-surface-2 p-3 text-xs">
                    <p>
                      Provider <Link href={`/admin/suppliers/${so.supplier.id}`} className="font-semibold text-primary">{so.supplier.name}</Link>
                      {so.supplierOrderId && <> · their order <code className="break-all">{so.supplierOrderId}</code></>} ·{" "}
                      <b className={so.status === "FAILED" || so.status === "UNKNOWN" ? "text-danger" : so.status === "SUCCESS" ? "text-success" : ""}>{statusLabel(so.status)}</b>
                      {so.remains != null && so.status === "PENDING" ? <span className="text-muted"> · {so.remains.toLocaleString("en-US")} left</span> : null}
                      {so.message && <span className="text-muted"> · {so.message}</span>}
                    </p>
                    {manage && (SO_OPEN.includes(so.status) || so.status === "FAILED") && (
                      <div className="flex flex-wrap gap-2">
                        {so.supplierOrderId && SO_OPEN.includes(so.status) && <ActionButton label="Check now" className="btn-secondary min-h-10 px-3 text-xs" action={supplierOrderAction.bind(null, so.id, "check")} />}
                        {so.status === "FAILED" && i.status === "PENDING" && <ActionButton label="Send again" className="btn-secondary min-h-10 px-3 text-xs" confirm="Send this line to the provider again with a new reference?" action={supplierOrderAction.bind(null, so.id, "retry")} />}
                        {so.status === "UNKNOWN" && i.status === "PENDING" && <ActionButton label="Not on their site: send again" className="btn-secondary min-h-10 px-3 text-xs" confirm="Only if you checked on the provider's site that this order does NOT exist there. Send it again?" action={supplierOrderAction.bind(null, so.id, "retry")} />}
                        {SO_OPEN.includes(so.status) && <ActionButton label="Close (handled)…" className="btn-ghost min-h-10 px-3 text-xs" prompt="What happened? (e.g. delivered on the provider's site, will refund)" action={supplierOrderAction.bind(null, so.id, "close")} />}
                      </div>
                    )}
                  </div>
                ))}
                {manage && i.status === "PENDING" && ["PAID", "PROCESSING", "FULFILLED"].includes(order.status) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <ActionButton label="Mark delivered…" className="btn-primary min-h-10 px-3 text-xs" prompt="Note shown to the customer (e.g. 'Delivered: 1,000 followers added')" action={deliverItem.bind(null, i.id)} />
                    {!i.supplierOrders.some((x) => SO_OPEN.includes(x.status)) && order.total > 0 && (
                      <ActionButton label="Refund this line…" className="btn-ghost min-h-10 px-3 text-xs text-danger" prompt={`Reason (the customer sees it). ${formatMoney(i.unitPrice * i.quantity, order.currency, "en")} goes back to the wallet.`} confirm="Refund this line to the customer's wallet?" action={refundLine.bind(null, i.id)} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
          {manage && (
            <div className="flex flex-col gap-4">
              {["PAID", "PROCESSING"].includes(order.status) && <div><ActionButton label="Send to providers again (automatic)" className="btn-secondary min-h-10 px-3 text-xs" action={runFulfillment.bind(null, order.id)} /></div>}
              {["AWAITING_PAYMENT", "PAYMENT_REVIEW", "PAID", "PROCESSING", "FAILED"].includes(order.status) && (
                <div className="border-t border-border pt-4">
                  <ActionButton label="Refund the whole order…" className="btn-danger min-h-10 px-3 text-xs" prompt="Reason (the customer sees it in the order history)" confirm="Refund what's left of this order to the customer's wallet?" action={refundOrder.bind(null, order.id)} />
                </div>
              )}
            </div>
          )}
          {can(staff, "codes.reveal") && order.items.some((i) => i._count.codes > 0) && <RevealCodes action={revealOrderCodes.bind(null, order.id)} />}
        </div>
        <div className="space-y-4">
          <section className="card p-5 text-sm">
            <h2 className="mb-2 font-semibold">Customer</h2>
            <Link href={`/admin/customers/${order.userId}`} className="inline-flex items-center gap-2 font-medium text-primary"><Avatar name={order.user.name} image={order.user.image} size={28} />{order.user.name}</Link>
            <p className="text-muted">{order.user.email} {order.user.phone && <>· <a href={`https://wa.me/${waNumber(order.user.phone)}`} target="_blank" rel="noopener" className="text-[#1fa855]">{formatPhone(order.user.phone)} ↗</a></>}</p>
            {order.recipientNote && <p className="mt-2"><span className="text-muted">Note:</span> {order.recipientNote}</p>}
            <p className="mt-2 break-all text-xs"><span className="text-muted">Tracking link:</span> {`${siteUrl()}/${order.user.locale}/order-status/${order.id}?t=${order.accessToken}`}</p>
          </section>
          <section className="card p-5 text-sm">
            <h2 className="mb-2 font-semibold">Payments</h2>
            {order.payments.length === 0 ? <p className="text-muted">{order.paymentMethod === "WALLET" ? "Paid from wallet" : "No payment yet"}</p> : order.payments.map((p) => (
              <p key={p.id} className="py-1">{methodLabel(p.provider)} · {formatMoney(p.amount, p.currency, "en")} · <b>{statusLabel(p.status)}</b> {p.providerRef && `· ${p.providerRef}`}</p>
            ))}
          </section>
          <section className="card p-5 text-sm">
            <h2 className="mb-2 font-semibold">History</h2>
            <ol className="space-y-2">
              {order.events.map((e) => (
                <li key={e.id}><b>{statusLabel(e.status)}</b> <span className="text-muted">{haitiDate(e.createdAt)}</span>{e.note && <><br /><span className="text-muted">{e.note}</span></>}</li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
