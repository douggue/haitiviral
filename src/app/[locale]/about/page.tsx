import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContentPage } from "@/components/ContentPage";
import { PayBadges } from "@/components/PayLogo";
import { Link } from "@/i18n/navigation";
import { pageSeo } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return pageSeo(locale, "/about", t("aboutTitle"));
}

/** About: who we are, what we do, how payment and refunds work, and where to go next. */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const [t, ta] = await Promise.all([getTranslations("pages"), getTranslations("aboutUi")]);
  const points = [1, 2, 3, 4].map((n) => ({ title: ta(`p${n}Title`), body: ta(`p${n}Body`) }));
  return (
    <ContentPage title={t("aboutTitle")}>
      <p className="text-lg leading-relaxed">{t("aboutBody")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {points.map((p) => (
          <div key={p.title} className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-base font-bold">{p.title}</h2>
            <p className="mt-1 text-sm leading-normal text-muted">{p.body}</p>
          </div>
        ))}
      </div>
      <PayBadges height={26} />
      <div className="flex flex-wrap gap-3">
        <Link href="/order" className="btn-primary min-h-12">{ta("ctaOrder")}</Link>
        <Link href="/contact" className="btn-secondary min-h-12">{ta("ctaContact")}</Link>
      </div>
    </ContentPage>
  );
}
