import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { t as txt } from "@/lib/text";
import { listAccountProducts } from "@/lib/accounts-shop";
import { accountBadge } from "@/lib/accounts";
import { Link } from "@/i18n/navigation";
import { PageBar } from "@/components/PageBar";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "acctUi" });
  return { title: t("title"), description: t("metaDescription") };
}

/** Accounts & SMS numbers shop: two tabs, one card per product (price per piece, delivery, warranty). */
export default async function AccountsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { tab } = await searchParams;
  const [t, tc, s, all] = await Promise.all([getTranslations("acctUi"), getTranslations("common"), getSettings(), listAccountProducts()]);
  const kind = tab === "sms" ? "sms" : "account";
  const items = all.filter((x) => x.meta.kind === kind);
  const fmt = (n: number) => formatMoney(n, "HTG", locale);
  return (
    <>
      <PageBar title={t("title")} back="/" backLabel={tc("back")} />
      <div className="mx-auto flex max-w-[560px] flex-col gap-4 px-5 py-[18px]">
        {!s.accountsEnabled ? <p className="py-10 text-center text-muted">{t("off")}</p> : <>
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-[14px] bg-surface-2 p-1">
            {(["account", "sms"] as const).map((k) => (
              <Link key={k} role="tab" aria-selected={kind === k} href={k === "sms" ? "/accounts?tab=sms" : "/accounts"}
                className={`flex min-h-11 items-center justify-center rounded-[11px] text-sm font-bold ${kind === k ? "bg-surface shadow-sm" : "text-muted"}`}>{t(k === "sms" ? "tabSms" : "tabAccounts")}</Link>
            ))}
          </div>
          <p className="text-[13px] leading-normal text-muted">{t(kind === "sms" ? "introSms" : "introAccounts")}</p>
          {items.length === 0 && <p className="py-8 text-center text-muted">{t("empty")}</p>}
          {items.map(({ product, variant, meta }) => (
            <Link key={product.id} href={`/accounts/${product.slug}`} className={`flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 ${variant.soldOut ? "opacity-60" : ""}`}>
              {(() => {
                const b = accountBadge(product.tags, meta.kind);
                return <span className="grid h-11 w-11 flex-none place-items-center rounded-xl text-sm font-extrabold text-white" style={{ background: b.color }}>{b.letters}</span>;
              })()}
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[15px] font-bold leading-snug">{txt(product.name, locale)}</span>
                <span className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                  <span className={`rounded-full px-2 py-0.5 ${meta.delivery === "instant" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEF3C7] text-[#92400E]"}`}>{t(meta.delivery === "instant" ? "instant" : "within24")}</span>
                  <span className={`rounded-full px-2 py-0.5 ${meta.warrantyHours ? "bg-[#E0E7FF] text-[#3730A3]" : "bg-[#F1F5F9] text-[#475569]"}`}>{meta.warrantyHours ? t("warrantyH", { h: meta.warrantyHours }) : t("noWarranty")}</span>
                  {variant.soldOut && <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[#991B1B]">{t("soldOut")}</span>}
                </span>
              </span>
              <span className="flex flex-none flex-col items-end">
                <span className="text-base font-extrabold">{fmt(variant.salePriceHtg ?? variant.priceHtg)}</span>
                <span className="text-[11px] text-muted">{t("perPiece")}</span>
              </span>
            </Link>
          ))}
        </>}
      </div>
    </>
  );
}
