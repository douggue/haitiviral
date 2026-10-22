import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getBalances } from "@/lib/ledger";
import { getDisplayCurrency } from "@/lib/prefs";
import { formatMoney } from "@/lib/money";
import { itemTitle } from "@/lib/orders";
import { WalletCard } from "@/components/WalletCard";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { emailEnabled } from "@/lib/email";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/Avatar";

export default async function Dashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const [ta, to, tw, fmt, balances, currency, orders, counts, activity] = await Promise.all([
    getTranslations("account"),
    getTranslations("order"),
    getTranslations("wallet"),
    getFormatter(),
    getBalances(prisma, user.id),
    getDisplayCurrency(),
    prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5, include: { items: true } }),
    prisma.order.groupBy({ by: ["status"], where: { userId: user.id }, _count: true }),
    prisma.ledgerEntry.findMany({
      where: { account: { userId: user.id, type: "CUSTOMER_WALLET" } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { transaction: true },
    }),
  ]);
  const count = (s: string[]) => counts.filter((c) => s.includes(c.status)).reduce((n, c) => n + c._count, 0);
  const stats = [
    { label: ta("statsOrders"), value: counts.reduce((n, c) => n + c._count, 0) },
    { label: ta("statsPending"), value: count(["AWAITING_PAYMENT", "PAYMENT_REVIEW", "PAID", "PROCESSING"]) },
    { label: ta("statsCompleted"), value: count(["FULFILLED"]) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar name={user.name} image={user.image} size={48} />
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{ta("welcome", { name: user.name.split(" ")[0] })}</h1>
      </div>
      {!user.emailVerified && emailEnabled() && <VerifyEmailBanner email={user.email} />}
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <WalletCard balances={balances} initial={currency} />
        <div className="grid grid-cols-3 gap-3 xl:grid-cols-1">
          {stats.map((s) => (
            <div key={s.label} className="card flex flex-col justify-center p-4 xl:flex-row xl:items-center xl:justify-between">
              <span className="text-xs text-muted sm:text-sm">{s.label}</span>
              <span className="text-2xl font-bold">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{ta("recentOrders")}</h2>
            <Link href="/account/orders" className="text-sm font-semibold text-primary">→</Link>
          </div>
          {orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{ta("noOrders")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/account/orders/${o.id}`} className="flex items-center gap-3 py-3 hover:text-primary">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{o.items[0] ? itemTitle(o.items[0], locale) : `#${o.number}`}</span>
                      <span className="text-xs text-muted">#{o.number} · {fmt.dateTime(o.createdAt, { dateStyle: "medium" })}</span>
                    </span>
                    <StatusBadge status={o.status} label={to(`status.${o.status}`)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{ta("recentActivity")}</h2>
            <Link href="/account/wallet" className="text-sm font-semibold text-primary">→</Link>
          </div>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{ta("noActivity")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="block font-medium">{tw(`tx.${e.transaction.type}`)}</span>
                    <span className="text-xs text-muted">{fmt.dateTime(e.createdAt, { dateStyle: "medium", timeStyle: "short" })}</span>
                  </span>
                  <span className={`font-semibold ${e.amount > 0 ? "text-success" : ""}`}>
                    {e.amount > 0 ? "+" : "−"}{formatMoney(Math.abs(e.amount), e.currency, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
