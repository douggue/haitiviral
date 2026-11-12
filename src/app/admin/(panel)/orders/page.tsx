import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { t as txt } from "@/lib/text";
import { haitiDate, methodLabel, statusLabel } from "@/lib/admin-labels";
import { PageTitle } from "@/components/admin/ui";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "Orders" };

const PER_PAGE = 50;
const FILTERS: Record<string, { label: string; where: Prisma.OrderWhereInput }> = {
  all: { label: "All", where: {} },
  stuck: {
    label: "Needs attention",
    where: {
      OR: [
        { items: { some: { supplierOrders: { some: { OR: [{ status: "UNKNOWN" }, { status: "FAILED", orderItem: { status: "PENDING" } }] } } } } },
        // Paid but nothing sent to a provider (hand delivery or not linked) for over an hour
        { status: { in: ["PAID", "PROCESSING"] }, paidAt: { lt: new Date(Date.now() - 3_600_000) }, items: { some: { status: "PENDING", supplierOrders: { none: {} } } } },
      ],
    },
  },
  running: { label: "In progress", where: { status: { in: ["PAID", "PROCESSING"] } } },
  done: { label: "Completed", where: { status: "FULFILLED" } },
  refunded: { label: "Refunded / canceled", where: { status: { in: ["REFUNDED", "CANCELED", "FAILED"] } } },
  unpaid: { label: "Waiting for payment", where: { status: { in: ["AWAITING_PAYMENT", "PAYMENT_REVIEW"] as OrderStatus[] } } },
};

/**
 * Orders: filter chips (with "Needs attention" for stuck ones), search by order #, name, email, phone, the link
 * or @username the customer gave, or the provider's order number. Compact cards on a phone.
 */
export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; page?: string }> }) {
  await requireStaff("orders.view");
  const sp = await searchParams;
  const f = sp.f && sp.f in FILTERS ? sp.f : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.OrderWhereInput = { ...FILTERS[f].where };
  const q = sp.q?.trim();
  if (q) {
    const n = Number(q.replace("#", ""));
    const linkMatch = q.replace(/^@/, "");
    const byLink = await prisma.$queryRaw<{ orderId: string }[]>`SELECT DISTINCT "orderId" FROM "OrderItem" WHERE "fieldValues"->>'link' ILIKE ${`%${linkMatch.replace(/[\\%_]/g, (c) => `\\${c}`)}%`} LIMIT 200`;
    where.AND = [{
      OR: [
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { phone: { contains: q.replace(/[^\d+]/g, "") || "—" } } },
        { items: { some: { supplierOrders: { some: { supplierOrderId: q } } } } },
        ...(byLink.length ? [{ id: { in: byLink.map((r) => r.orderId) } }] : []),
        ...(Number.isInteger(n) && n > 0 ? [{ number: n }] : []),
      ],
    }];
  }
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where, orderBy: { createdAt: "desc" }, take: PER_PAGE, skip: (page - 1) * PER_PAGE,
      include: { user: { select: { name: true, email: true } }, items: { select: { productName: true, fieldValues: true, supplierOrders: { select: { status: true } } } } },
    }),
    prisma.order.count({ where }),
  ]);
  const chip = (on: boolean) => `inline-flex min-h-10 items-center rounded-full border px-3.5 text-[13px] font-bold ${on ? "border-[#0F172A] bg-[#0F172A] text-white dark:border-text dark:bg-text dark:text-surface" : "border-[#CBD2E1] bg-surface dark:border-border"}`;
  const href = (o: { f?: string; page?: number }) => `/admin/orders?${new URLSearchParams({ ...(o.f ?? f) !== "all" ? { f: o.f ?? f } : {}, ...(q ? { q } : {}), ...(o.page && o.page > 1 ? { page: String(o.page) } : {}) })}`;
  const what = (o: (typeof orders)[number]) => {
    const i = o.items[0];
    if (!i) return "—";
    const qty = Number((i.fieldValues as Record<string, string> | null)?.quantity) || 0;
    return `${txt(i.productName, "en")}${qty ? ` · ${qty.toLocaleString("en-US")}` : ""}${o.items.length > 1 ? ` +${o.items.length - 1} more` : ""}`;
  };
  const stuck = (o: (typeof orders)[number]) => o.items.some((i) => i.supplierOrders.some((s) => s.status === "UNKNOWN" || s.status === "FAILED"));
  return (
    <>
      <PageTitle title="Orders" sub={`${total.toLocaleString("en-US")} order${total === 1 ? "" : "s"}${f !== "all" ? ` · ${FILTERS[f].label}` : ""}`} />
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {Object.entries(FILTERS).map(([k, v]) => <Link key={k} href={href({ f: k, page: 1 })} className={chip(f === k)}>{v.label}</Link>)}
      </div>
      <form className="mb-4 flex gap-2">
        {f !== "all" && <input type="hidden" name="f" value={f} />}
        <input name="q" defaultValue={q} placeholder="Order #, name, email, phone, link, @username, provider order #" className="input min-w-0 flex-1" />
        <button className="btn-primary">Search</button>
      </form>

      <div className="card divide-y divide-border">
        {orders.map((o) => (
          <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-2 text-sm font-bold">
                #{o.number}
                <span className="tabular-nums">{o.total === 0 ? "Free" : formatMoney(o.total, o.currency, "en")}</span>
                <StatusBadge status={stuck(o) ? "FAILED" : o.status} label={stuck(o) ? "Stuck" : statusLabel(o.status)} />
              </span>
              <span className="truncate text-[13px]">{what(o)}</span>
            </span>
            <span className="flex flex-none flex-col text-xs text-muted sm:items-end">
              <span>{o.user.name || o.user.email}</span>
              <span>{haitiDate(o.createdAt)} · {methodLabel(o.paymentMethod)}</span>
            </span>
          </Link>
        ))}
        {!orders.length && <p className="px-4 py-8 text-center text-sm text-muted">{q ? "No order matches this search." : f === "stuck" ? "Nothing stuck. All good." : "No orders here yet."}</p>}
      </div>

      {total > PER_PAGE && (
        <div className="mt-4 flex items-center justify-between gap-2 text-sm">
          {page > 1 ? <Link href={href({ page: page - 1 })} className="btn-secondary min-h-10 px-4">← Newer</Link> : <span />}
          <span className="text-muted">Page {page} of {Math.ceil(total / PER_PAGE)}</span>
          {page * PER_PAGE < total ? <Link href={href({ page: page + 1 })} className="btn-secondary min-h-10 px-4">Older →</Link> : <span />}
        </div>
      )}
    </>
  );
}
