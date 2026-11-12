import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageBar } from "@/components/PageBar";
import { kDate } from "@/lib/kreyol-date";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { StatusBadge } from "@/components/StatusBadge";
import { ReplyForm } from "@/components/SupportForms";

export default async function TicketPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const ticket = await prisma.supportTicket.findFirst({ where: { id, userId: user.id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!ticket) notFound();
  const t = await getTranslations("support");
  const tone = { OPEN: "PROCESSING", WAITING_CUSTOMER: "PENDING", CLOSED: "CANCELED" } as const;
  return (
    <>
    <PageBar title={t("ticket", { number: ticket.number })} back="/account/support" backLabel={t("back")} right={<StatusBadge status={tone[ticket.status]} label={t(`status${ticket.status}`)} />} />
    <div className="mx-auto max-w-[560px] space-y-5 px-5 pb-8 pt-2 lg:mx-0 lg:max-w-none lg:px-0">
      <h2 className="text-lg font-bold">{ticket.subject}</h2>
      <ol className="space-y-3">
        {ticket.messages.map((m) => (
          <li key={m.id} className={`max-w-[90%] rounded-2xl p-4 text-sm ${m.fromStaff ? "bg-surface border border-border" : "ml-auto bg-primary-soft"}`}>
            <p className="mb-1 text-xs font-semibold text-muted">{m.fromStaff ? t("team") : t("you")} · {kDate(m.createdAt, locale)}</p>
            <p className="whitespace-pre-wrap">{m.body}</p>
            {m.attachmentPath && <a href={`/api/support/attachment/${m.id}`} target="_blank" className="mt-2 inline-block text-xs font-semibold text-primary">📎 {t("attach")}</a>}
          </li>
        ))}
      </ol>
      {ticket.status === "CLOSED" && <p className="text-sm text-muted">{t("closedNote")}</p>}
      <ReplyForm ticketId={ticket.id} />
    </div>
    </>
  );
}
