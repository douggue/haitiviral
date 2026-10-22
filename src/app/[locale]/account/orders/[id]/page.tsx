import { siteUrl } from "@/lib/site-url";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { itemTitle, revealCode } from "@/lib/orders";
import { audit } from "@/lib/audit";
import { t } from "@/lib/text";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { NatcashOrderForm, MoncashRetryButton } from "@/components/OrderPayment";
import { WhatsAppIcon } from "@/components/Icons";
import { ReviewRequest } from "@/components/ReviewRequest";
import { formatPhone } from "@/lib/phone";
import { randomToken } from "@/lib/crypto";
import { GiftShare } from "@/components/GiftShare";

export default async function OrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const order = await prisma.order.findFirst({
    where: { id, userId: user.id },
    include: {
      items: { include: { codes: true, variant: { include: { product: { select: { slug: true } } } } } },
      events: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      review: { select: { id: true } },
    },
  });
  if (!order) notFound();
  const [to, tc, fmt, settings, ts] = await Promise.all([getTranslations("order"), getTranslations("common"), getFormatter(), getSettings(), getTranslations("support")]);

  const manual = order.manualMethodId ? await prisma.manualMethod.findUnique({ where: { id: order.manualMethodId } }) : null;
  const codes = order.items.flatMap((i) => i.codes);
  if (codes.length > 0) await audit(user.id, "code.view.customer", "Order", order.id, { codes: codes.length });

  const statusUrl = `${siteUrl()}/${locale}/order-status/${order.id}?t=${order.accessToken}`;
  // Gift: after delivery, a ready WhatsApp message for the person receiving it (codes go through a private link).
  let giftText: string | null = null;
  if (order.status === "FULFILLED") {
    const tg = await getTranslations("gift");
    const what = order.items.map((i) => `${t(i.variantName, locale)} ${t(i.productName, locale)}`).join(", ");
    const note = order.recipientNote ? `"${order.recipientNote}"\n\n` : "";
    if (codes.length > 0) {
      const token = order.giftToken ?? (await prisma.order.update({ where: { id: order.id }, data: { giftToken: randomToken(24) } })).giftToken!;
      giftText = `${note}${tg("messageCode", { what, url: `${siteUrl()}/${locale}/gift/${token}` })}`;
    } else {
      const ids = order.items.flatMap((i) => Object.values(i.fieldValues as Record<string, string>)).filter(Boolean).join(", ");
      giftText = `${note}${tg("messageTopup", { what })}${ids ? ` (${ids})` : ""}\n\n— Haiti Gaming · haitigaming.net`;
    }
  }
  const helpText = encodeURIComponent(`${tc("whatsappMessage")} ${to("title", { number: order.number })} ${statusUrl}`);
  const lastPayment = order.payments[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/account/orders" className="text-sm text-muted hover:text-text">← {tc("orders")}</Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{to("title", { number: order.number })}</h1>
          <p className="text-sm text-muted">{to("placedOn", { date: fmt.dateTime(order.createdAt, { dateStyle: "long", timeStyle: "short" }) })}</p>
        </div>
        <StatusBadge status={order.status} label={to(`status.${order.status}`)} />
      </div>

      {order.status === "FULFILLED" && !order.review && <ReviewRequest orderId={order.id} city={(await prisma.user.findUnique({ where: { id: user.id }, select: { city: true } }))?.city ?? ""} />}

      {order.status === "AWAITING_PAYMENT" && order.paymentMethod === "MANUAL" && manual && (
        <section className="card border-warning p-5">
          <h2 className="font-semibold">{t(manual.name, locale)}</h2>
          {t(manual.instructions, locale) && <p className="mt-1 whitespace-pre-line text-sm">{t(manual.instructions, locale)}</p>}
          <p className="mt-1 text-sm text-muted">
            {to("payNatcashBody", { amount: formatMoney(order.total, "HTG", locale), name: manual.recipientName, phone: formatPhone(manual.recipientNumber) }).replace("NatCash", t(manual.name, locale))}
          </p>
          {lastPayment?.status === "REJECTED" && lastPayment.reviewNote && <p className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{lastPayment.reviewNote}</p>}
          <NatcashOrderForm orderId={order.id} phone={manual.recipientNumber} methodName={t(manual.name, locale)} />
        </section>
      )}
      {order.status === "AWAITING_PAYMENT" && order.paymentMethod === "NATCASH" && (
        <section className="card border-warning p-5">
          <h2 className="font-semibold">{to("payNatcashTitle")}</h2>
          <p className="mt-1 text-sm text-muted">
            {to("payNatcashBody", { amount: formatMoney(order.total, "HTG", locale), name: settings.natcashRecipientName, phone: formatPhone(settings.natcashRecipientPhone) })}
          </p>
          {lastPayment?.status === "REJECTED" && lastPayment.reviewNote && (
            <p className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{lastPayment.reviewNote}</p>
          )}
          <NatcashOrderForm orderId={order.id} phone={settings.natcashRecipientPhone} />
        </section>
      )}
      {order.status === "AWAITING_PAYMENT" && order.paymentMethod === "MONCASH" && (
        <section className="card p-5">
          <MoncashRetryButton orderId={order.id} />
        </section>
      )}
      {order.status === "PAYMENT_REVIEW" && (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          {to("proofSubmitted")} {to("reviewTime", { hours: settings.supportHours })}
        </p>
      )}
      {["PAID", "PROCESSING"].includes(order.status) && (
        <p className="rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary">{to("waitingDelivery")}</p>
      )}

      <section className="card divide-y divide-border">
        <h2 className="p-5 font-semibold">{to("items")}</h2>
        {order.items.map((item) => (
          <div key={item.id} className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{itemTitle(item, locale)} × {item.quantity}</p>
                {Object.keys(item.fieldValues as object).length > 0 && (
                  <p className="text-sm text-muted">{Object.values(item.fieldValues as Record<string, string>).join(" · ")}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{formatMoney(item.unitPrice * item.quantity, order.currency, locale)}</span>
                <StatusBadge status={item.status} label={to(`itemStatus.${item.status}`)} />
              </div>
            </div>
            {item.codes.length > 0 && (
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="mb-2 text-sm font-semibold">{to("yourCodes")}</p>
                <ul className="space-y-2">
                  {item.codes.map((c) => {
                    const code = revealCode(c.codeEncrypted);
                    return (
                      <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2">
                        <code className="break-all font-mono text-sm font-semibold">{code}</code>
                        <CopyButton value={code} label={to("copy")} done={to("copied")} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {item.deliveryNote && (
              <div className="rounded-xl bg-surface-2 p-4 text-sm">
                <p className="font-semibold">{to("deliveryNote")}</p>
                <p className="mt-1 whitespace-pre-wrap">{item.deliveryNote}</p>
              </div>
            )}
            <Link href={`/products/${item.variant.product.slug}`} className="inline-block text-sm font-semibold text-primary">{to("buyAgain")} →</Link>
          </div>
        ))}
        <div className="flex items-center justify-between p-5">
          <span className="text-muted">{to("paidWith")}: {order.paymentMethod}</span>
          <span className="text-lg font-bold">{formatMoney(order.total, order.currency, locale)}</span>
        </div>
        {order.recipientNote && <p className="p-5 text-sm"><span className="text-muted">{to("recipientNote")}:</span> {order.recipientNote}</p>}
      </section>

      {giftText && <GiftShare text={giftText} hasNote={!!order.recipientNote} />}

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">{to("timeline")}</h2>
        <ol className="relative space-y-4 border-l border-border pl-5">
          {order.events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-primary" aria-hidden />
              <p className="text-sm font-medium">{to(`status.${e.status}`)}</p>
              <p className="text-xs text-muted">{fmt.dateTime(e.createdAt, { dateStyle: "medium", timeStyle: "short" })}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap gap-3">
        <a href={`https://wa.me/${settings.whatsappNumber}?text=${helpText}`} target="_blank" rel="noopener" className="btn-secondary">
          <WhatsAppIcon width={18} height={18} className="text-[#1fa855]" /> {to("getHelp")}
        </a>
        <CopyButton value={statusUrl} label={to("shareStatus")} done={to("copied")} />
        <Link href={`/account/support?order=${order.id}`} className="btn-secondary">{ts("new")}</Link>
      </div>
    </div>
  );
}
