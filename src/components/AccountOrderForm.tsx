"use client";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { placeAccountOrder } from "@/actions/accounts";
import { formatMoney } from "@/lib/money";

/** Buy accounts / SMS numbers: what it is, quantity, the provider's required input, warranty terms, pay from the wallet. */
export function AccountOrderForm(p: {
  variantId: string; slug: string; kind: "account" | "sms"; signedIn: boolean; balance: number | null; price: number; min: number; max: number;
  available: boolean; delivery: "instant" | "24h"; warrantyHours: number; about: string; require: string | null; stock: number | null;
}) {
  const t = useTranslations("acctUi");
  const locale = useLocale();
  const router = useRouter();
  const [qty, setQty] = useState(p.min);
  const [req, setReq] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const fmt = (n: number) => formatMoney(n, "HTG", locale);
  const total = p.price * qty;
  const short = p.balance !== null && total > p.balance;
  const ready = p.signedIn && p.available && accepted && (!p.require || req.trim()) && !short;
  const step = "h-11 w-11 rounded-xl border border-[#CBD2E1] bg-surface text-xl font-extrabold disabled:opacity-40 dark:border-border";
  const submit = () =>
    start(async () => {
      setError("");
      const r = await placeAccountOrder({ variantId: p.variantId, quantity: qty, require: req, accepted });
      if (r.ok) router.push(`/account/orders/${r.orderId}`);
      else setError(t.has(`error_${r.error}`) ? t(`error_${r.error}`) : t("error_generic"));
    });
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-5 pb-8 pt-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-2xl font-extrabold">{fmt(p.price)}</span>
          <span className="text-xs text-muted">{t("perPiece")}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
          <span className="flex flex-col gap-0.5 rounded-xl bg-surface-2 p-2"><b className="text-[13px]">{t(p.delivery === "instant" ? "instant" : "within24")}</b><span className="text-muted">{t("delivery")}</span></span>
          <span className="flex flex-col gap-0.5 rounded-xl bg-surface-2 p-2"><b className="text-[13px]">{p.warrantyHours ? t("warrantyH", { h: p.warrantyHours }) : t("noWarranty")}</b><span className="text-muted">{t("warranty")}</span></span>
          <span className="flex flex-col gap-0.5 rounded-xl bg-surface-2 p-2"><b className="text-[13px]">{p.stock === null ? t("onOrder") : p.stock}</b><span className="text-muted">{t("stock")}</span></span>
        </div>
        {p.about && <p className="whitespace-pre-line text-sm leading-normal text-text/80">{p.about}</p>}
      </section>

      <section className="flex items-center justify-between gap-3">
        <span id="qty" className="text-sm font-semibold">{t("quantity")}</span>
        <div role="group" aria-labelledby="qty" className="flex items-center gap-1.5">
          <button type="button" disabled={qty <= p.min} onClick={() => setQty((q) => Math.max(p.min, q - 1))} aria-label={t("less")} className={step}>−</button>
          <span className="min-w-10 text-center text-xl font-extrabold">{qty}</span>
          <button type="button" disabled={qty >= p.max} onClick={() => setQty((q) => Math.min(p.max, q + 1))} aria-label={t("more")} className={step}>+</button>
        </div>
      </section>

      {p.require && (
        <section className="flex flex-col gap-2">
          <label htmlFor="req" className="text-sm font-semibold">{p.require}</label>
          <input id="req" value={req} maxLength={200} onChange={(e) => setReq(e.target.value)} className="h-[50px] rounded-xl border border-[#CBD2E1] bg-surface px-3.5 text-base dark:border-border" />
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border border-[#FCD34D] bg-[#FFFBEB] p-3.5 text-[13px] leading-normal text-[#78350F] dark:border-border dark:bg-surface-2 dark:text-text">
        <b>{t("termsTitle")}</b>
        <ul className="list-disc space-y-1 pl-4">
          <li>{p.warrantyHours ? t("termWarranty", { h: p.warrantyHours }) : t("termNoWarranty")}</li>
          <li>{t(p.kind === "sms" ? "termSms" : "termChange")}</li>
          <li>{t("termRules")}</li>
          <li>{t("termNoRefund")}</li>
        </ul>
        <label className="mt-1 flex cursor-pointer items-start gap-2.5 font-semibold">
          <input type="checkbox" checked={accepted} onChange={() => setAccepted((a) => !a)} className="m-0 h-[22px] w-[22px] flex-none accent-[#0F172A]" />
          <span>{t("accept")}</span>
        </label>
      </section>

      <section className="flex items-baseline justify-between rounded-2xl border border-border bg-surface p-4">
        <span className="text-[15px] font-bold">{t("total")}</span>
        <span className="text-2xl font-extrabold">{fmt(total)}</span>
      </section>
      {short && <p className="rounded-[10px] bg-[#FEE2E2] px-3 py-2.5 text-[13px] text-[#991B1B]">{t("short")} <Link href="/account/wallet" className="font-bold underline">{t("addFunds")}</Link></p>}
      {!p.available && <p className="rounded-[10px] bg-[#FEF3C7] px-3 py-2.5 text-[13px] text-[#92400E]">{t("unavailable")}</p>}
      {error && <p role="alert" className="rounded-[10px] bg-[#FEE2E2] px-3 py-2.5 text-[13px] text-[#991B1B]">{error}</p>}
      {p.signedIn ? (
        <button type="button" onClick={submit} disabled={!ready || pending}
          className={`flex h-[54px] items-center justify-center rounded-[14px] text-base font-bold ${ready && !pending ? "bg-text text-surface" : "bg-[#CBD5E1] text-[#475569]"}`}>
          {pending ? t("sending") : t("buy", { total: fmt(total) })}
        </button>
      ) : (
        <Link href={`/auth/login?next=/accounts/${p.slug}`} className="flex h-[54px] items-center justify-center rounded-[14px] bg-text text-base font-bold text-surface">{t("signIn")}</Link>
      )}
      <p className="text-center text-xs leading-normal text-muted">{t(p.delivery === "instant" ? "afterInstant" : "after24")}</p>
    </div>
  );
}
