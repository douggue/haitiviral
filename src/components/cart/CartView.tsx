"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { t } from "@/lib/text";
import { linePrice, useStore } from "./CartProvider";
import { Price } from "../Money";
import { ProductArtSmall } from "./ProductArtSmall";

export function CartView() {
  const tc = useTranslations("cart");
  const locale = useLocale();
  const { lines, ready, setQuantity, remove, htgPerUsd } = useStore();
  const subtotal = lines.reduce((s, l) => s + l.priceHtg * l.quantity, 0);
  const subtotalUsd = lines.reduce((s, l) => s + linePrice(l, "USD", htgPerUsd) * l.quantity, 0);

  if (!ready) return <p className="text-muted">…</p>;
  if (lines.length === 0)
    return (
      <div className="card mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">{tc("title")}</h1>
        <p className="mt-2 text-muted">{tc("empty")}</p>
        <Link href="/store" className="btn-primary mt-6">{tc("emptyCta")}</Link>
      </div>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{tc("title")}</h1>
        <ul className="mt-6 space-y-3">
          {lines.map((l) => (
            <li key={l.key} className="card flex gap-4 p-3 sm:p-4">
              <ProductArtSmall name={t(l.productName, locale)} accent={l.accent} image={l.image} />
              <div className="min-w-0 flex-1">
                <Link href={`/products/${l.productSlug}`} className="font-semibold hover:text-primary">{t(l.productName, locale)}</Link>
                <p className="text-sm text-muted">{t(l.variantName, locale)}</p>
                {Object.values(l.fields).length > 0 && <p className="mt-0.5 truncate text-xs text-muted">{Object.values(l.fields).join(" · ")}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-lg border border-border">
                    <button type="button" className="h-9 w-9" onClick={() => setQuantity(l.key, l.quantity - 1)} aria-label="−">−</button>
                    <span className="w-8 text-center text-sm font-semibold">{l.quantity}</span>
                    <button type="button" className="h-9 w-9" onClick={() => setQuantity(l.key, l.quantity + 1)} aria-label="+">+</button>
                  </div>
                  <button type="button" onClick={() => remove(l.key)} className="text-sm text-danger hover:underline">{tc("remove")}</button>
                  <Price htg={l.priceHtg * l.quantity} usd={linePrice(l, "USD", htgPerUsd) * l.quantity} className="ml-auto font-bold" />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Link href="/store" className="mt-4 inline-block text-sm font-semibold text-primary">← {tc("continueShopping")}</Link>
      </div>
      <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-24">
        <div className="flex items-center justify-between">
          <span className="text-muted">{tc("subtotal")}</span>
          <Price htg={subtotal} usd={subtotalUsd} className="text-xl font-bold" />
        </div>
        <p className="text-xs text-muted">{tc("priceNote")}</p>
        <Link href="/checkout" className="btn-primary w-full">{tc("checkout")}</Link>
      </aside>
    </div>
  );
}
