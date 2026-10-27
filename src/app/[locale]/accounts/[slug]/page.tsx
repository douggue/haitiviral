import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { t as txt } from "@/lib/text";
import { parseAccountMeta } from "@/lib/accounts";
import { stockFor } from "@/lib/accounts-shop";
import { getBalances } from "@/lib/ledger";
import { PageBar } from "@/components/PageBar";
import { AccountOrderForm } from "@/components/AccountOrderForm";

async function load(slug: string) {
  const p = await prisma.product.findFirst({ where: { slug, isPublished: true, category: { slug: { in: ["accounts", "sms"] } } }, include: { variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 1 } } });
  const v = p?.variants[0];
  const meta = v ? parseAccountMeta(v.account) : null;
  return p && v && meta ? { p, v, meta } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const x = await load(slug);
  return x ? { title: txt(x.p.name, locale) } : {};
}

/** One account / SMS product: what it is, delivery and warranty, quantity, the provider's required input, consent. */
export default async function AccountProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const x = await load(slug);
  if (!x) notFound();
  const { p, v, meta } = x;
  const [t, tc, user, s, stock] = await Promise.all([getTranslations("acctUi"), getTranslations("common"), getUser(), getSettings(), stockFor(v)]);
  const balance = user ? (await getBalances(prisma, user.id)).HTG.available : null;
  const max = stock === null ? meta.max : Math.min(meta.max, stock);
  return (
    <>
      <PageBar title={txt(p.name, locale)} back={meta.kind === "sms" ? "/accounts?tab=sms" : "/accounts"} backLabel={tc("back")} />
      <AccountOrderForm
        variantId={v.id} slug={p.slug} kind={meta.kind} signedIn={!!user} balance={balance} price={v.salePriceHtg ?? v.priceHtg}
        min={meta.min} max={max} available={s.accountsEnabled && !v.soldOut && max >= meta.min} delivery={meta.delivery} warrantyHours={meta.warrantyHours}
        about={txt(meta.about, locale)} require={meta.require ? txt(meta.require, locale) : null} stock={stock}
      />
    </>
  );
}
