import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCategories, minPrice, searchProducts } from "@/lib/catalog";
import { t } from "@/lib/text";
import { pageSeo } from "@/lib/seo";
import { StoreBrowser, type StoreCategory, type StoreProduct } from "@/components/StoreBrowser";

type SP = Promise<{ q?: string; category?: string; sort?: string; tag?: string; min?: string; max?: string }>;

const LOCALES = ["ht", "fr", "en", "es"] as const;
const allNames = (v: unknown) => LOCALES.map((l) => t(v, l)).filter(Boolean);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const ts = await getTranslations({ locale, namespace: "store" });
  return pageSeo(locale, "/store", ts("title"), ts("subtitle"));
}

/**
 * The whole catalog is sent once (a few KB per product) and StoreBrowser filters it in the browser,
 * so search results change while typing. The address (?q=&category=&tag=a,b&min=&max=&sort=) still opens the same view.
 */
export default async function StorePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SP }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const [categories, all] = await Promise.all([getCategories(), searchProducts({})]);

  const parentOf = new Map<string, string>();
  const cats: StoreCategory[] = [];
  for (const c of categories) {
    cats.push({ slug: c.slug, name: t(c.name, locale), icon: c.icon, top: true });
    for (const ch of c.children) {
      parentOf.set(ch.id, c.slug);
      cats.push({ slug: ch.slug, name: t(ch.name, locale), icon: ch.icon, top: false });
    }
  }
  const catNames = new Map([...categories, ...categories.flatMap((c) => c.children)].map((c) => [c.id, allNames(c.name)]));

  const products: StoreProduct[] = all.map((p) => {
    const parent = parentOf.get(p.categoryId);
    const parentId = parent ? categories.find((c) => c.slug === parent)?.id : undefined;
    return {
      id: p.id,
      slug: p.slug,
      name: t(p.name, locale),
      image: p.image,
      accent: p.accent,
      tags: p.tags,
      price: minPrice(p),
      onSale: p.variants.some((v) => v.salePriceHtg),
      soldOut: p.variants.length > 0 && p.variants.every((v) => v.soldOut),
      instant: p.fulfillmentType === "CODE_INVENTORY",
      delivery: t(p.deliveryEstimate, locale),
      cat: parent ?? p.category.slug,
      sub: parent ? p.category.slug : null,
      created: p.createdAt.getTime(),
      haystack: [...allNames(p.name), p.slug.replace(/-/g, " "), ...p.tags, ...(catNames.get(p.categoryId) ?? []), ...(parentId ? catNames.get(parentId) ?? [] : [])],
    };
  });
  const tags = [...new Set(products.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b));
  const init = {
    q: (sp.q ?? "").slice(0, 80),
    category: sp.category ?? "",
    sort: ["price_asc", "price_desc", "newest"].includes(sp.sort ?? "") ? sp.sort! : "",
    tags: (sp.tag ?? "").split(",").map((x) => x.trim()).filter((x) => tags.includes(x)),
    min: sp.min ?? "",
    max: sp.max ?? "",
  };

  return (
    <div className="container-page py-8 sm:py-12">
      <StoreBrowser products={products} categories={cats} tags={tags} init={init} />
    </div>
  );
}
