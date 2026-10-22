"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { t } from "@/lib/text";
import type { FieldDef } from "@/lib/orders";
import { useStore } from "./cart/CartProvider";
import { Price } from "./Money";
import { formatMoney, parseAmount } from "@/lib/money";
import { amountInRange, customerRate, quoteAmount } from "@/lib/amount";
import type { ExchangePricing } from "@/lib/amount";

type Variant = { id: string; name: Record<string, string>; priceHtg: number; salePriceHtg: number | null; inStock: boolean; lowStock?: boolean };
type Props = {
  product: { id: string; slug: string; name: Record<string, string>; accent: string | null; image: string | null; fields: FieldDef[]; variants: Variant[] };
  saved: { id: string; label: string | null; values: Record<string, string> }[];
  pricing?: ExchangePricing;
};

export function ProductPurchase({ product, saved, pricing }: Props) {
  const tp = useTranslations("product");
  const locale = useLocale();
  const router = useRouter();
  const { add } = useStore();
  const mode = pricing ?? null;
  const [amountText, setAmountText] = useState(mode?.presets[0] ? String(mode.presets[0]) : "");
  const amount = parseAmount(amountText);
  const quote = mode && amount && amountInRange(mode, amount) ? quoteAmount(mode, amount) : null;
  const usd = (minor: number) => formatMoney(minor, "USD", locale);
  const firstAvailable = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const [qty, setQty] = useState(1);
  const [fields, setFields] = useState<Record<string, string>>(saved[0]?.values ?? {});
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((v) => v.id === variantId);

  function submit(goToCart: boolean) {
    setError("");
    if (!variant || !variant.inStock) return;
    if (mode && !quote) {
      setError(tp("amountError", { min: usd(mode.min), max: usd(mode.max) }));
      document.getElementById("amount")?.focus();
      return;
    }
    for (const f of product.fields) {
      if (f.required && !fields[f.key]?.trim()) {
        setError(`${t(f.label, locale)} *`);
        document.getElementById(`field-${f.key}`)?.focus();
        return;
      }
    }
    add({
      variantId: variant.id,
      productSlug: product.slug,
      productName: product.name,
      variantName: quote ? { ht: usd(quote.amount), fr: usd(quote.amount), en: usd(quote.amount), es: usd(quote.amount) } : variant.name,
      accent: product.accent,
      image: product.image,
      priceHtg: quote ? quote.totalHtg : variant.salePriceHtg ?? variant.priceHtg,
      ...(quote ? { amount: quote.amount, priceUsd: quote.totalUsd } : {}),
      quantity: quote ? 1 : qty,
      fields: Object.fromEntries(product.fields.map((f) => [f.key, (fields[f.key] ?? "").trim()]).filter(([, v]) => v)),
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    if (goToCart) router.push("/cart");
  }

  return (
    <div className="mt-6 space-y-6">
      {mode ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-success/30 bg-success-soft px-4 py-3 text-success">
            <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
              <span className="h-2.5 w-2.5 rounded-full bg-success shadow-[0_0_0_4px_rgba(19,138,82,.18)]" aria-hidden />
              {tp("rateToday")}
            </span>
            <span className="text-lg font-extrabold tabular-nums">1 USD = {new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-HT", { maximumFractionDigits: 2 }).format(customerRate(mode))} HTG</span>
          </div>
          <div>
            <label htmlFor="amount" className="label">{tp("enterUsd")}</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted">$</span>
              <input
                id="amount"
                className="input h-14 pl-9 text-xl font-bold"
                inputMode="decimal"
                autoComplete="off"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value.replace(",", ".").replace(/[^\d.]/g, "").slice(0, 9))}
                aria-describedby="amount-hint"
              />
            </div>
            <p id="amount-hint" className="mt-1 text-xs text-muted">{tp("amountRange", { min: usd(mode.min), max: usd(mode.max) })}</p>
            {mode.presets.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {mode.presets.map((p) => (
                  <button key={p} type="button" onClick={() => setAmountText(String(p))} className={`min-h-10 rounded-xl border px-4 text-sm font-semibold ${amount === p * 100 ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface"}`}>
                    ${p}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2 rounded-2xl border border-border bg-surface-2 p-4" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-muted">{t(product.name, locale)}:</span>
              <span className="text-right">
                <b className="text-lg tabular-nums">{quote ? usd(quote.amount) : "—"}</b>
                {quote && quote.fee > 0 && <span className="ml-2 text-sm font-semibold text-warning">+ {usd(quote.fee)} {tp("fee")}</span>}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-muted">{tp("youPay")}:</span>
              <b className="text-xl tabular-nums">{quote ? formatMoney(quote.totalHtg, "HTG", locale) : "—"}</b>
            </div>
          </div>
        </div>
      ) : (
      <fieldset>
        <legend className="label">{tp("chooseOption")}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {product.variants.map((v) => {
            const active = v.id === variantId;
            return (
              <label
                key={v.id}
                className={`relative flex cursor-pointer flex-col rounded-xl border-2 p-3 transition-colors ${
                  active ? "border-primary bg-primary-soft" : "border-border bg-surface hover:border-steel"
                } ${!v.inStock ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <input type="radio" name="variant" value={v.id} checked={active} disabled={!v.inStock} onChange={() => setVariantId(v.id)} className="sr-only" />
                <span className={`pr-4 text-sm font-semibold ${!v.inStock ? "text-muted line-through decoration-danger decoration-2" : ""}`}>{t(v.name, locale)}</span>
                <span className="mt-1 text-sm">
                  <Price htg={v.salePriceHtg ?? v.priceHtg} className={`font-bold ${!v.inStock ? "text-muted" : ""}`} />
                  {v.salePriceHtg && <Price htg={v.priceHtg} className="ml-1.5 text-xs text-muted line-through" />}
                </span>
                {!v.inStock && <span className="mt-1 text-xs font-semibold text-danger">{tp("soldOut")}</span>}
                {/* Green: available · orange (pulsing): stock is low · red: sold out */}
                <span
                  className={`absolute right-2.5 top-2.5 h-2 w-2 rounded-full ${!v.inStock ? "bg-danger" : v.lowStock ? "low-dot bg-warning" : "bg-success"}`}
                  title={!v.inStock ? tp("soldOut") : v.lowStock ? tp("lowStock") : tp("inStock")}
                  aria-hidden
                />
              </label>
            );
          })}
        </div>
        {variant?.inStock && variant.lowStock && <LowStock name={t(variant.name, locale)} seed={variant.id} />}
      </fieldset>
      )}

      {product.fields.length > 0 && (
        <fieldset className="card space-y-4 p-4">
          <legend className="sr-only">{tp("requiredInfo")}</legend>
          <p className="text-sm font-semibold">{tp("requiredInfo")}</p>
          {saved.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {saved.map((s) => (
                <button key={s.id} type="button" className="badge border border-border bg-surface-2 px-3 py-1.5" onClick={() => setFields(s.values)}>
                  {s.label ?? Object.values(s.values)[0]}
                </button>
              ))}
            </div>
          )}
          {product.fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={`field-${f.key}`} className="label">
                {t(f.label, locale)} {f.required && <span className="text-danger">*</span>}
              </label>
              <input
                id={`field-${f.key}`}
                className="input"
                type={f.type === "number" ? "text" : f.type}
                inputMode={f.type === "number" ? "numeric" : undefined}
                autoComplete="off"
                maxLength={100}
                placeholder={f.placeholder}
                value={fields[f.key] ?? ""}
                onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
              />
            </div>
          ))}
          {/* Only game top-ups ask for a player ID: the "for someone else" tip makes no sense on an email or phone field. */}
          {product.fields.some((f) => /player|uid|gameid|game_id|zone|server/i.test(f.key)) && (
            <p className="text-xs text-muted">
              <strong>{tp("sendToSomeone")}</strong> {tp("sendToSomeoneHint")}
            </p>
          )}
        </fieldset>
      )}

      {!mode && <div className="flex items-center gap-3">
        <label className="label mb-0" htmlFor="qty">{tp("quantity")}</label>
        <div className="flex items-center rounded-xl border border-border bg-surface">
          <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="−">−</button>
          <input id="qty" className="h-11 w-12 bg-transparent text-center font-semibold" value={qty} readOnly />
          <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty(Math.min(10, qty + 1))} aria-label="+">+</button>
        </div>
        {variant && <Price htg={(variant.salePriceHtg ?? variant.priceHtg) * qty} className="ml-auto text-xl font-bold" />}
      </div>}

      {error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn-secondary min-h-12" onClick={() => submit(false)} disabled={!variant?.inStock}>
          {added ? `✓ ${tp("added")}` : tp("addToCart")}
        </button>
        <button type="button" className="btn-primary min-h-12" onClick={() => submit(true)} disabled={!variant?.inStock}>
          {tp("buyNow")}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{added ? tp("added") : ""}</p>
    </div>
  );
}

/** Bar length 12–38 %, different per option but the same on every visit (so it doesn't jump on reload). */
function barWidth(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 12 + (h % 27);
}

/** "Stock is low" — never a number: only appears on options under the limit set in Admin → Trust. */
function LowStock({ name, seed }: { name: string; seed: string }) {
  const tp = useTranslations("product");
  return (
    <div role="status" className="animate-rise mt-3 flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3">
      <span className="low-dot h-3 w-3 shrink-0 rounded-full bg-warning" aria-hidden />
      <span className="min-w-0 flex-1">
        <b className="block text-sm text-warning">{tp("lowStock")}</b>
        <span className="text-xs text-muted">{tp("lowStockHint", { name })}</span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <span className="low-bar block h-full rounded-full" style={{ width: `${barWidth(seed)}%` }} />
        </span>
      </span>
    </div>
  );
}
