import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { t as txt } from "@/lib/text";
import { kDate } from "@/lib/kreyol-date";
import { OrderHelpButton } from "@/components/OrderHelpButton";
import { LOOK, LOOK_LABEL, type orderSummary } from "./order-summary";

type Summary = ReturnType<typeof orderSummary>;

/** Status pill: the same word on "My orders" and on the order page. */
export async function OrderStatusPill({ s }: { s: Summary }) {
  const t = await getTranslations("ordersUi");
  const [bg, fg] = LOOK[s.look];
  return <span className="flex-none rounded-full px-2.5 py-[5px] text-xs font-bold" style={{ background: bg, color: fg }}>{t(LOOK_LABEL[s.look])}</span>;
}

/**
 * Progress bar, started/delivered counts, partial/refund notes, refill window and the refill / order again /
 * cancel buttons. `again` is where "Order again" goes (null hides it).
 */
export async function OrderProgress({ s, orderId, total, currency, status, locale, again, packLines }: {
  s: Summary;
  orderId: string;
  total: number;
  currency: "HTG" | "USD";
  status: string;
  locale: string;
  again: string | null;
  packLines?: React.ReactNode;
}) {
  const t = await getTranslations("ordersUi");
  const [bg, fg, bar] = LOOK[s.look];
  const refunded = status === "REFUNDED" || status === "CANCELED";
  const finished = s.look === "done" || s.look === "partial";
  return (
    <>
      <div className="h-2 overflow-hidden rounded-full bg-[#EEF0F5] dark:bg-surface-2"><div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: bar }} /></div>
      {packLines}
      <div className="flex justify-between gap-2 text-xs text-muted">
        <span>{t("started", { n: s.startCount != null ? s.startCount.toLocaleString("en-US") : "—" })}</span>
        <span>{s.qty ? t("delivered", { done: s.done.toLocaleString("en-US"), total: s.qty.toLocaleString("en-US") }) : ""}</span>
        <span className="font-bold text-text">{total === 0 ? t("free") : formatMoney(total, currency, locale)}</span>
      </div>
      {s.look === "partial" && <p className="rounded-[10px] px-3 py-2.5 text-xs leading-normal dark:!bg-surface-2 dark:!text-text" style={{ background: bg, color: fg }}>{t("notePartial", { done: s.done.toLocaleString("en-US"), total: s.qty.toLocaleString("en-US"), amount: formatMoney(s.refundedPart, currency, locale) })}</p>}
      {refunded && <p className="rounded-[10px] px-3 py-2.5 text-xs leading-normal dark:!bg-surface-2 dark:!text-text" style={{ background: bg, color: fg }}>{t("noteRefunded", { amount: formatMoney(total, currency, locale) })}</p>}
      {finished && !s.pack && s.refill !== "none" && (
        <p className="text-xs text-muted">
          {s.refill === "running" ? t("refillRunning") : s.refill === "wait" ? t("refillWait") : s.refill === "over" ? t("refillOver") : t("refillUntil", { date: kDate(s.refillUntil!, locale, { time: false }) })}
        </p>
      )}
      {finished && (
        <div className="flex gap-2">
          {!s.pack && s.refill === "open" && (
            <OrderHelpButton orderId={orderId} kind="refill" label={t("refill")} className="flex min-h-11 w-full flex-1 items-center justify-center gap-1.5 rounded-xl border border-text bg-surface text-sm font-bold text-text">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
            </OrderHelpButton>
          )}
          {again && <Link href={again} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary-soft text-sm font-bold text-text">{t("again")}</Link>}
        </div>
      )}
      {s.look === "run" && s.meta && <p className="text-xs text-[#1E40AF] dark:text-primary">{t("avg", { time: txt(s.meta.avg, locale) })}</p>}
      {s.canCancel && (
        <OrderHelpButton orderId={orderId} kind="cancel" label={t("cancel")} requested={s.cancelAsked} className="min-h-11 w-full rounded-xl border border-[#FCA5A5] bg-surface px-3 text-sm font-bold text-[#B91C1C]" />
      )}
    </>
  );
}
