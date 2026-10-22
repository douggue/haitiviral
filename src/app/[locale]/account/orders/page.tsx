import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { itemTitle } from "@/lib/orders";
import { StatusBadge } from "@/components/StatusBadge";

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const [tc, to, ta, fmt] = await Promise.all([getTranslations("common"), getTranslations("order"), getTranslations("account"), getFormatter()]);
  const orders = await prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100, include: { items: true } });
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tc("orders")}</h1>
      {orders.length === 0 ? (
        <div className="card mt-6 p-10 text-center text-muted">{ta("noOrders")}</div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/account/orders/${o.id}`} className="card lift flex flex-wrap items-center gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{o.items.map((i) => itemTitle(i, locale)).join(", ")}</span>
                  <span className="text-sm text-muted">#{o.number} · {fmt.dateTime(o.createdAt, { dateStyle: "medium" })}</span>
                </span>
                <span className="font-semibold">{formatMoney(o.total, o.currency, locale)}</span>
                <StatusBadge status={o.status} label={to(`status.${o.status}`)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
