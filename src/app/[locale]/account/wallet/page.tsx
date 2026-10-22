import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getBalances } from "@/lib/ledger";
import { getDisplayCurrency } from "@/lib/prefs";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { WalletCard } from "@/components/WalletCard";
import { StatusBadge } from "@/components/StatusBadge";

export default async function WalletPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const [tw, fmt, balances, currency, settings, entries, pending] = await Promise.all([
    getTranslations("wallet"),
    getFormatter(),
    getBalances(prisma, user.id),
    getDisplayCurrency(),
    getSettings(),
    prisma.ledgerEntry.findMany({
      where: { account: { userId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { transaction: true, account: { select: { type: true } } },
    }),
    prisma.paymentIntent.findMany({
      where: { userId: user.id, orderId: null, status: { in: ["PENDING", "REVIEW", "REJECTED"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tw("title")}</h1>
      <div className="max-w-xl"><WalletCard balances={balances} initial={currency} /></div>
      <p className="max-w-xl text-sm text-muted">{tw("storeCredit")} {tw("heldHint", { hours: settings.holdHours })}</p>

      {pending.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">{tw("pending")}</h2>
          <ul className="divide-y divide-border">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  <span className="font-medium">{p.provider}</span> · {formatMoney(p.amount, p.currency, locale)}
                  {p.providerRef && <span className="text-muted"> · {p.providerRef}</span>}
                  {p.status === "REJECTED" && p.reviewNote && <span className="block text-xs text-danger">{p.reviewNote}</span>}
                </span>
                <StatusBadge status={p.status} label={tw(`depositStatus.${p.status}`)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">{tw("history")}</h2>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{tw("noHistory")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">
                    {tw(`tx.${e.transaction.type}`)}
                    {e.account.type === "CUSTOMER_HELD" && <span className="badge ml-2 bg-warning-soft text-warning">⏳</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {fmt.dateTime(e.createdAt, { dateStyle: "medium", timeStyle: "short" })} · {e.transaction.description}
                  </span>
                </span>
                <span className={`shrink-0 font-semibold ${e.amount > 0 ? "text-success" : ""}`}>
                  {e.amount > 0 ? "+" : "−"}{formatMoney(Math.abs(e.amount), e.currency, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
