import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/text";
import { PageTitle, Stat } from "@/components/admin/ui";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  // Same part of yesterday (midnight → this time) so the comparison is fair early in the day.
  const ySince = new Date(since.getTime() - 86_400_000);
  const yUntil = new Date(Date.now() - 86_400_000);
  const [todayOrders, todayRevenue, reviews, processing, risks, liabilities, lowStock] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.ledgerEntry.groupBy({ by: ["currency"], where: { createdAt: { gte: since }, account: { type: "REVENUE" } }, _sum: { amount: true } }),
    prisma.paymentIntent.count({ where: { status: "REVIEW" } }),
    prisma.order.count({ where: { status: "PROCESSING" } }),
    prisma.riskFlag.count({ where: { status: "OPEN" } }),
    prisma.ledgerAccount.groupBy({ by: ["currency"], where: { type: { in: ["CUSTOMER_WALLET", "CUSTOMER_HELD"] } }, _sum: { balance: true } }),
    prisma.$queryRaw<{ id: string; name: unknown; product: unknown; stock: bigint }[]>`
      SELECT v.id, v.name, p.name as product, COUNT(c.id) FILTER (WHERE c.status = 'AVAILABLE') as stock
      FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
      LEFT JOIN "CodeItem" c ON c."variantId" = v.id
      WHERE p."fulfillmentType" = 'CODE_INVENTORY' AND v."isActive" = true
      GROUP BY v.id, p.name HAVING COUNT(c.id) FILTER (WHERE c.status = 'AVAILABLE') < 3
      ORDER BY stock ASC LIMIT 10`,
  ]);
  const [yOrders, yRevenue] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: ySince, lt: yUntil } } }),
    prisma.ledgerEntry.groupBy({ by: ["currency"], where: { createdAt: { gte: ySince, lt: yUntil }, account: { type: "REVENUE" } }, _sum: { amount: true } }),
  ]);
  const delta = (now: number, before: number) => {
    if (!before) return now ? { text: "new", good: true } : undefined;
    const pct = Math.round(((now - before) / before) * 100);
    return { text: `${pct >= 0 ? "↗" : "↘"} ${Math.abs(pct)}% vs yesterday`, good: pct >= 0 };
  };
  const yRev = Math.abs(yRevenue.find((r) => r.currency === "HTG")?._sum.amount ?? 0);
  const rev = (c: "HTG" | "USD") => todayRevenue.find((r) => r.currency === c)?._sum.amount ?? 0;
  const liab = (c: "HTG" | "USD") => liabilities.find((r) => r.currency === c)?._sum.balance ?? 0;
  const recent = await prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true } } } });

  return (
    <>
      {sp.denied && <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">Your role does not have access to that page.</p>}
      <PageTitle title="Dashboard" sub="Today at a glance" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders today" value={todayOrders} delta={delta(todayOrders, yOrders)} />
        <Stat label="Sales today" value={<span className="text-xl">{formatMoney(rev("HTG"), "HTG", "en")}{rev("USD") ? ` + ${formatMoney(rev("USD"), "USD", "en")}` : ""}</span>} delta={delta(Math.abs(rev("HTG")), yRev)} />
        <Stat label="Payments to review" value={<Link href="/admin/payments">{reviews}</Link>} tone={reviews ? "warn" : undefined} />
        <Stat label="Orders to fulfill" value={<Link href="/admin/orders?status=PROCESSING">{processing}</Link>} tone={processing ? "warn" : undefined} />
        <Stat label="Open risk flags" value={<Link href="/admin/risk">{risks}</Link>} tone={risks ? "danger" : undefined} />
        <Stat label="Wallet liabilities HTG" value={<span className="text-xl">{formatMoney(liab("HTG"), "HTG", "en")}</span>} />
        <Stat label="Wallet liabilities USD" value={<span className="text-xl">{formatMoney(liab("USD"), "USD", "en")}</span>} />
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Recent orders</h2>
          <ul className="divide-y divide-border text-sm">
            {recent.map((o) => (
              <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="flex justify-between gap-3 py-2.5 hover:text-primary"><span>#{o.number} · {o.user.name}</span><span className="text-muted">{o.status} · {formatMoney(o.total, o.currency, "en")}</span></Link></li>
            ))}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Low code stock (&lt; 3)</h2>
          {lowStock.length === 0 ? <p className="text-sm text-muted">All code variants are stocked.</p> : (
            <ul className="divide-y divide-border text-sm">
              {lowStock.map((v) => (
                <li key={v.id} className="flex justify-between py-2.5"><span>{t(v.product, "en")} — {t(v.name, "en")}</span><span className={Number(v.stock) === 0 ? "font-bold text-danger" : "text-warning"}>{Number(v.stock)}</span></li>
              ))}
            </ul>
          )}
          <Link href="/admin/codes" className="mt-3 inline-block text-sm font-semibold text-primary">Import codes →</Link>
        </section>
      </div>
    </>
  );
}
