import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageBar } from "@/components/PageBar";
import { kAgo } from "@/lib/kreyol-date";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { NewTicketForm } from "@/components/SupportForms";
import { WhatsAppIcon } from "@/components/Icons";

export default async function SupportPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ order?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const sp = await searchParams;
  const [t, tc, settings, tickets, orders] = await Promise.all([
    getTranslations("support"),
    getTranslations("common"),
    getSettings(),
    prisma.supportTicket.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, number: true } }),
  ]);
  // A link from an order ("open a ticket") picks that order, even when it is older than the 20 listed.
  if (sp.order && !orders.some((o) => o.id === sp.order)) {
    const extra = await prisma.order.findFirst({ where: { id: String(sp.order).slice(0, 40), userId: user.id }, select: { id: true, number: true } });
    if (extra) orders.unshift(extra);
  }
  const defaultOrder = orders.some((o) => o.id === sp.order) ? sp.order : undefined;
  const tone = { OPEN: "PROCESSING", WAITING_CUSTOMER: "PENDING", CLOSED: "CANCELED" } as const;
  return (
    <>
    <PageBar title={t("title")} back="/account" backLabel={tc("back")} />
    <div className="mx-auto max-w-[560px] space-y-6 px-5 pb-8 pt-2 lg:mx-0 lg:max-w-none lg:px-0">
      <div>
        <p className="text-sm text-muted">{t("intro")}</p>
        <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#15803D] dark:text-success"><WhatsAppIcon width={16} height={16} /> {t("orWhatsapp")}</a>
      </div>
      <NewTicketForm orders={orders} defaultOrder={defaultOrder} />
      {tickets.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {tickets.map((tk) => (
            <li key={tk.id}>
              <Link href={`/account/support/${tk.id}`} className="card lift flex flex-wrap items-center gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{tk.subject}</span>
                  <span className="text-xs text-muted">{t("ticket", { number: tk.number })} · {kAgo(tk.updatedAt, locale)}</span>
                </span>
                <StatusBadge status={tone[tk.status]} label={t(`status${tk.status}`)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
    </>
  );
}
