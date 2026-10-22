import { siteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { locales } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [pages, news, products, categories] = await Promise.all([
    prisma.page.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    prisma.newsArticle.findMany({ where: { isPublished: true, publishedAt: { lte: new Date() } }, select: { slug: true, updatedAt: true } }),
    prisma.product.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ where: { isVisible: true }, select: { slug: true, updatedAt: true } }),
  ]);
  const paths: { path: string; lastModified?: Date }[] = [
    { path: "" }, { path: "/store" }, { path: "/categories" }, { path: "/guides" }, { path: "/faq" },
    { path: "/about" }, { path: "/news" }, { path: "/contact" }, { path: "/terms" }, { path: "/privacy" }, { path: "/refunds" },
    ...categories.map((c) => ({ path: `/categories/${c.slug}`, lastModified: c.updatedAt })),
    ...products.map((p) => ({ path: `/products/${p.slug}`, lastModified: p.updatedAt })),
    ...news.map((n) => ({ path: `/news/${n.slug}`, lastModified: n.updatedAt })),
    ...pages.map((p) => ({ path: `/p/${p.slug}`, lastModified: p.updatedAt })),
  ];
  return paths.flatMap(({ path, lastModified }) =>
    locales.map((l) => ({
      url: `${base}/${l}${path}`,
      lastModified,
      alternates: { languages: Object.fromEntries(locales.map((x) => [x, `${base}/${x}${path}`])) },
    })),
  );
}
