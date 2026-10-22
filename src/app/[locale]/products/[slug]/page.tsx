import { siteUrl } from "@/lib/site-url";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { minPrice, productCardInclude, searchProducts } from "@/lib/catalog";
import { getDisplaySettings } from "@/lib/settings";
import { isExchangeProduct } from "@/lib/amount";
import { getUser } from "@/lib/session";
import { t } from "@/lib/text";
import { alternates } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductPurchase } from "@/components/ProductPurchase";
import { BoltIcon, ShieldIcon } from "@/components/Icons";
import type { FieldDef } from "@/lib/orders";
import { lowStockVariants, recentSales } from "@/lib/trust";
import { SalesPopup } from "@/components/SalesPopup";

type P = Promise<{ locale: string; slug: string }>;

async function load(slug: string) {
  return prisma.product.findFirst({ where: { slug, isPublished: true }, include: productCardInclude });
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await load(slug);
  if (!p) return {};
  const title = t(p.seoTitle, locale) || t(p.name, locale);
  const description = t(p.seoDescription, locale) || t(p.description, locale).slice(0, 160);
  return { title, description, alternates: alternates(locale, `/products/${slug}`), openGraph: { title, description, ...(p.image ? { images: [p.image] } : {}) } };
}

export default async function ProductPage({ params }: { params: P }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const product = await load(slug);
  if (!product) notFound();
  const [tp, tc, settings, user] = await Promise.all([getTranslations("product"), getTranslations("common"), getDisplaySettings(), getUser()]);
  const saved = user
    ? await prisma.savedPlayerId.findMany({ where: { userId: user.id, productId: product.id }, orderBy: { createdAt: "desc" }, take: 5 })
    : [];
  const stock = product.fulfillmentType === "CODE_INVENTORY"
    ? Object.fromEntries(
        (await prisma.codeItem.groupBy({ by: ["variantId"], where: { status: "AVAILABLE", variantId: { in: product.variants.map((v) => v.id) } }, _count: true }))
          .map((g) => [g.variantId, g._count]),
      )
    : null;
  const low = new Set(lowStockVariants(product.variants, stock, settings.lowStockLimit));
  const sales = settings.salesPopupEnabled ? await recentSales(product.id, settings.moneyExchange) : [];
  const related = (await searchProducts({ category: product.category.slug, take: 5 })).filter((p) => p.id !== product.id).slice(0, 4);
  const name = t(product.name, locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: t(product.description, locale),
    ...(product.image ? { image: [product.image, ...((product.gallery ?? []) as string[])] } : {}),
    brand: { "@type": "Brand", name: settings.businessName },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "HTG",
      lowPrice: (minPrice(product) / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: "https://schema.org/InStock",
    },
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tc("store"), item: `${siteUrl()}/${locale}/store` },
      { "@type": "ListItem", position: 2, name: t(product.category.name, locale), item: `${siteUrl()}/${locale}/categories/${product.category.slug}` },
      { "@type": "ListItem", position: 3, name },
    ],
  };

  return (
    <div className="container-page py-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, crumbs]) }} />
      <nav className="text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/store" className="hover:text-text">{tc("store")}</Link> /{" "}
        <Link href={`/categories/${product.category.slug}`} className="hover:text-text">{t(product.category.name, locale)}</Link>
      </nav>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <ProductGallery name={name} accent={product.accent} images={[product.image, ...((product.gallery ?? []) as string[])].filter((x): x is string => !!x)} />
          <div className="card space-y-3 p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <BoltIcon width={18} height={18} className="text-success" />
              {tp("delivery")}: <span className="font-normal text-muted">{t(product.deliveryEstimate, locale)}</span>
            </p>
            <p className="flex items-center gap-2 font-semibold">
              <ShieldIcon width={18} height={18} className="text-primary" />
              <span className="font-normal text-muted">{product.fulfillmentType === "CODE_INVENTORY" ? tp("instant") : tp("manual")}</span>
            </p>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{name}</h1>
          <p className="mt-3 text-muted">{t(product.description, locale)}</p>
          <ProductPurchase
            product={{
              id: product.id,
              slug: product.slug,
              name: product.name as Record<string, string>,
              accent: product.accent,
              image: product.image,
              fields: product.fields as FieldDef[],
              variants: product.variants.map((v) => ({
                id: v.id,
                name: v.name as Record<string, string>,
                priceHtg: v.priceHtg,
                salePriceHtg: v.salePriceHtg,
                inStock: !v.soldOut && (stock ? (stock[v.id] ?? 0) > 0 : true),
                lowStock: low.has(v.id),
              })),
            }}
            pricing={isExchangeProduct(settings.moneyExchange, product.category) ? settings.moneyExchange : undefined}
            saved={saved.map((s) => ({ id: s.id, label: s.label, values: s.values as Record<string, string> }))}
          />
        </div>
      </div>
      {sales.length > 0 && <SalesPopup sales={sales} product={{ name, image: product.image, accent: product.accent }} perVisit={Math.min(5, Math.max(1, settings.salesPopupPerVisit))} />}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold">{tp("related")}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
