import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCategories } from "@/lib/catalog";
import { t } from "@/lib/text";
import { pageSeo } from "@/lib/seo";
import { CategoryCard } from "@/components/CategoryCard";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tc = await getTranslations({ locale, namespace: "common" });
  return pageSeo(locale, "/categories", tc("categories"));
}

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [tc, categories] = await Promise.all([getTranslations("common"), getCategories()]);
  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight">{tc("categories")}</h1>
      <div className="stagger mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {categories.map((c, i) => (
          <CategoryCard
            key={c.id}
            href={`/categories/${c.slug}`}
            name={t(c.name, locale)}
            count={`${c._count.products} ${tc("products")}`}
            sub={c.children.length > 0 ? c.children.map((ch) => t(ch.name, locale)).join(", ") : undefined}
            cover={c.cover}
            image={c.image}
            icon={c.icon}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
