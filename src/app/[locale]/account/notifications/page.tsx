import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { markNotificationsRead } from "@/actions/account";
import { PrefsForm } from "@/components/PrivacyForms";
import { emailEnabled } from "@/lib/email";
import { PushToggle } from "@/components/PushToggle";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const [tn, fmt] = await Promise.all([getTranslations("notifications"), getFormatter()]);
  const [items, me] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.user.findUnique({ where: { id: user.id }, select: { notifyPrefs: true } }),
  ]);
  const render = (type: string, params: Record<string, string | number>) => {
    const p = { ...params };
    if (typeof p.amount === "number") p.amount = formatMoney(p.amount, (p.currency as "HTG" | "USD") ?? "HTG", locale);
    delete p.currency;
    return tn.has(type) ? tn(type, p) : type;
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tn("title")}</h1>
        {items.some((i) => !i.readAt) && (
          <form action={markNotificationsRead}><button className="btn-secondary min-h-10">{tn("markAllRead")}</button></form>
        )}
      </div>
      <div className="mt-6 max-w-xl"><PushToggle /></div>
      {items.length === 0 ? (
        <div className="card mt-6 p-10 text-center text-muted">{tn("empty")}</div>
      ) : (
        <ul className="card mt-6 divide-y divide-border">
          {items.map((n) => {
            const body = (
              <>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-primary"}`} aria-hidden />
                <span className="flex-1">
                  <span className={`block text-sm ${n.readAt ? "" : "font-semibold"}`}>{render(n.type, n.params as Record<string, string | number>)}</span>
                  <span className="text-xs text-muted">{fmt.relativeTime(n.createdAt)}</span>
                </span>
              </>
            );
            return (
              <li key={n.id}>
                {n.link ? <Link href={n.link} className="flex gap-3 p-4 hover:bg-surface-2">{body}</Link> : <div className="flex gap-3 p-4">{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-8 max-w-xl"><PrefsForm prefs={(me?.notifyPrefs ?? {}) as Record<string, boolean>} emailOn={emailEnabled()} /></div>
    </div>
  );
}
