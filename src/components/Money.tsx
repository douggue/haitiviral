"use client";
import { useLocale } from "next-intl";
import { formatMoney, priceIn } from "@/lib/money";
import { useStore } from "./cart/CartProvider";

/** Shows an HTG-based price in the visitor's display currency. */
export function Price({ htg, usd, className }: { htg: number; usd?: number; className?: string }) {
  const { currency, htgPerUsd } = useStore();
  const locale = useLocale();
  const value = currency === "USD" && usd != null ? usd : priceIn(htg, currency, htgPerUsd);
  return <span className={className}>{formatMoney(value, currency, locale)}</span>;
}
