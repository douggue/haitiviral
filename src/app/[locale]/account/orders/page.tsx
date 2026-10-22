import type { OrderStatus, Prisma } from "@prisma/client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { t as txt } from "@/lib/text";
import { parseMeta, PLATFORMS } from "@/lib/services";
import { PageBar } from "@/components/PageBar";
import { OrderHelpButton } from "@/components/OrderHelpButton";

type Look = "run" | "done" | "partial" | "cancel" | "wait";
const LOOK: Record<Look, [bg: string, fg: string, bar: string]> = {
  run: ["#DBEAFE", "#1E40AF", "#2563EB"],
  done: ["#DCFCE7", "#166534", "#16A34A"],
  partial: ["#FEF3C7", "#92400E", "#D97706"],
  cancel: ["#FEE2E2", "#991B1B", "#DC2626"],
  wait: ["#F1F5F9", "#334155", "#94A3B8"],
};
const lookOf = (s: OrderStatus): Look =>
  s === "FULFILLED" ? "done" : s === "PAID" || s === "PROCESSING" ? "run" : s === "AWAITING_PAYMENT" || s === "PAYMENT_REVIEW" ? "wait" : "cancel";
const FILTERS: Record<string, Prisma.OrderWhereInput["status"]> = {
  running: { in: ["PAID", "PROCESSING"] },
  done: "FULFILLED",
  partial: { in: [] },
};

/** My orders (mockup "Kòmand mwen yo"): filters, one card per order with progress, refill, order again and cancel. */
export default async function OrdersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ f?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const { f } = await searchParams;
  const filter = f && f in FILTERS ? f : "all";
  const t = await getTranslations("ordersUi");
  const orders = await prisma.order.findMany({
    where: { userId: user.id, ...(filter !== "all" ? { status: FILTERS[filter] } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { items: { include: { variant: { include: { product: { include: { category: true } } } } } } },
  });
  const now = new Date();
  const day = (d: Date) => {
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (d.toDateString() === now.toDateString()) return `${t("today")} ${time}`;
    if (d.toDateString() === new Date(now.getTime() - 86400000).toDateString()) return t("yesterday");
    return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "fr-HT", { day: "numeric", month: "short" });
  };
  const chip = (on: boolean) => `flex-none inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] font-bold ${on ? "border-text bg-text text-surface" : "border-[#CBD2E1] bg-surface text-text/80 dark:border-border"}`;

  return (
    <>
      <PageBar title={t("title")}>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {(["all", "running", "done", "partial"] as const).map((k) => (
            <Link key={k} href={k === "all" ? "/account/orders" : `/account/orders?f=${k}`} className={chip(filter === k)} aria-current={filter === k ? "page" : undefined}>{t(k)}</Link>
          ))}
        </div>
      </PageBar>
      <div className="mx-auto flex max-w-[560px] flex-col gap-3 px-5 py-4">
        {orders.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-muted">{t("empty")}</p>
            <Link href="/order" className="rounded-[14px] bg-text px-5 py-3 text-sm font-bold text-surface">{t("emptyCta")}</Link>
          </div>
        )}
        {orders.map((o) => {
          const item = o.items[0];
          const product = item?.variant.product;
          const platform = product ? PLATFORMS[product.category.slug] : undefined;
          const meta = parseMeta(item?.variant.service);
          const fv = (item?.fieldValues ?? {}) as Record<string, string>;
          const qty = Number(fv.quantity) || 0;
          const look = lookOf(o.status);
          const [bg, fg, bar] = LOOK[look];
          const pct = look === "done" ? 100 : look === "run" ? 8 : 0;
          const name = product ? `${txt(product.name, locale)}${qty ? ` · ${qty.toLocaleString("en-US")}` : ""}` : `#${o.number}`;
          const statusLabel = look === "run" ? t("running") : look === "done" ? t("done") : look === "wait" ? t("waiting") : t("canceled");
          const refunded = o.status === "REFUNDED" || o.status === "CANCELED";
          return (
            <article key={o.id} className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-3.5">
              <Link href={`/account/orders/${o.id}`} className="flex items-start justify-between gap-2.5 text-text">
                <span className="flex items-center gap-2.5">
                  {product?.category.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.category.image} alt="" className="h-[38px] w-[38px] rounded-[11px] object-cover" />
                  ) : (
                    <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] text-sm font-extrabold text-white" style={{ background: platform?.color ?? "#334155" }}>{platform?.letter ?? "•"}</span>
                  )}
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{name}</span>
                    <span className="text-xs text-muted">#{o.number} · {day(o.createdAt)}</span>
                  </span>
                </span>
                <span className="flex-none rounded-full px-2.5 py-[5px] text-xs font-bold" style={{ background: bg, color: fg }}>{statusLabel}</span>
              </Link>
              <div className="h-2 overflow-hidden rounded-full bg-[#EEF0F5] dark:bg-surface-2"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: bar }} /></div>
              <div className="flex justify-between text-xs text-muted">
                <span>{t("started", { n: "—" })}</span>
                <span>{qty ? t("delivered", { done: (look === "done" ? qty : 0).toLocaleString("en-US"), total: qty.toLocaleString("en-US") }) : ""}</span>
                <span className="font-bold text-text">{o.total === 0 ? t("free") : formatMoney(o.total, o.currency, locale)}</span>
              </div>
              {refunded && <p className="rounded-[10px] px-3 py-2.5 text-xs leading-normal" style={{ background: bg, color: fg }}>{t("noteRefunded", { amount: formatMoney(o.total, o.currency, locale) })}</p>}
              {look === "done" && (
                <div className="flex gap-2">
                  {!!meta?.refillDays && (
                    <OrderHelpButton orderId={o.id} kind="refill" label={t("refill")} done={t("requested")} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-text bg-surface text-sm font-bold text-text">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
                    </OrderHelpButton>
                  )}
                  {product && (
                    <Link href={`/order?platform=${product.category.slug}&kind=${product.tags.find((x) => x.startsWith("kind:"))?.slice(5) ?? ""}`} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary-soft text-sm font-bold text-text">{t("again")}</Link>
                  )}
                </div>
              )}
              {look === "run" && meta && <p className="text-xs text-[#1E40AF] dark:text-primary">{t("avg", { time: txt(meta.avg, locale) })}</p>}
              {look === "run" && (
                <OrderHelpButton orderId={o.id} kind="cancel" label={t("cancel")} done={t("requested")} className="min-h-11 rounded-xl border border-[#FCA5A5] bg-surface px-3 text-sm font-bold text-[#B91C1C]" />
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
