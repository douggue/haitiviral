import type { Prisma } from "@prisma/client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { t as txt } from "@/lib/text";
import { PLATFORMS } from "@/lib/services";
import { PageBar } from "@/components/PageBar";
import { kAgo } from "@/lib/kreyol-date";
import { lineDone, orderSummary, summaryItemInclude } from "@/components/account/order-summary";
import { OrderProgress, OrderStatusPill } from "@/components/account/OrderProgress";

const FILTERS: Record<string, Prisma.OrderWhereInput> = {
  running: { status: { in: ["PAID", "PROCESSING"] } },
  done: { status: "FULFILLED", items: { none: { supplierOrders: { some: { refundedPartial: { gt: 0 } } } } } },
  partial: { items: { some: { supplierOrders: { some: { refundedPartial: { gt: 0 } } } } } },
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
    where: { userId: user.id, ...(filter !== "all" ? FILTERS[filter] : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      items: {
        orderBy: { id: "asc" },
        include: {
          variant: { include: { product: { include: { category: true } } } },
          ...summaryItemInclude,
        },
      },
    },
  });
  const now = new Date();
  // Cancel asked through a ticket (orders not linked to a provider): show "request sent" instead of the button.
  const asked = new Set((await prisma.supportTicket.findMany({ where: { userId: user.id, subject: { startsWith: "Anile #" }, status: { not: "CLOSED" }, orderId: { in: orders.map((o) => o.id) } }, select: { orderId: true } })).map((x) => x.orderId));
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
          const sum = orderSummary(o, now);
          if (asked.has(o.id)) sum.cancelAsked = true;
          const { pack, qty, fv } = sum;
          const name = pack ? txt(pack, locale) : product ? `${txt(product.name, locale)}${qty ? ` · ${qty.toLocaleString("en-US")}` : ""}` : `#${o.number}`;
          const again = pack ? `/order/pack/${fv.pack}` : product ? (["accounts", "sms"].includes(product.category.slug) ? `/accounts/${product.slug}` : `/order?platform=${product.category.slug}&kind=${product.tags.find((x) => x.startsWith("kind:"))?.slice(5) ?? ""}`) : null;
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
                    <span className="text-xs text-muted">#{o.number} · {kAgo(o.createdAt, locale, now)}</span>
                  </span>
                </span>
                <OrderStatusPill s={sum} />
              </Link>
              <OrderProgress s={sum} orderId={o.id} total={o.total} currency={o.currency} status={o.status} locale={locale} again={again}
                packLines={pack && (
                  <ul className="flex flex-col gap-1 rounded-[10px] bg-surface-2 px-3 py-2 text-xs">
                    {o.items.map((i) => {
                      const q = Number(((i.fieldValues ?? {}) as Record<string, string>).quantity) || 0;
                      return (
                        <li key={i.id} className="flex justify-between gap-2">
                          <span className="truncate">{txt(i.variant.product.name, locale)}</span>
                          <span className={`flex-none font-semibold ${i.status === "FAILED" ? "text-[#B91C1C]" : ""}`}>{i.status === "FAILED" ? t("lineRefunded") : `${lineDone(i).toLocaleString("en-US")} / ${q.toLocaleString("en-US")}`}</span>
                        </li>
                      );
                    })}
                  </ul>
                )} />
            </article>
          );
        })}
      </div>
    </>
  );
}
