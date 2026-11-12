import { Fragment } from "react";
import { jsonLd } from "@/lib/json-ld";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/session";
import { isStaff } from "@/lib/permissions";
import { normalizeHomepage } from "@/lib/homepage";
import { pageSeo } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";
import { PayBadges } from "@/components/PayLogo";
import { PlatformIcon } from "@/components/PlatformIcon";
import { Link } from "@/i18n/navigation";
import { getDisplaySettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/text";
import { parseMeta, PLATFORMS, productKind } from "@/lib/services";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageSeo(locale, "/", "");
}

/** Home (mockup "Akèy"): services status, hero, free trial, then the sections chosen and ordered in Admin → Homepage. */
export default async function HomePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const viewer = sp.preview ? await getUser() : null;
  const preview = !!viewer && isStaff(viewer.role) && !!viewer.twoFactorEnabled;
  const [th, tc, tt, tf, settings, categories, packs, popular, reviews, news] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getTranslations("trust"),
    getTranslations("faq"),
    getDisplaySettings(),
    prisma.category.findMany({ where: { isVisible: true, parentId: null, slug: { in: Object.keys(PLATFORMS) } }, orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({ where: { isPublished: true, category: { slug: "pake" } }, orderBy: { sortOrder: "asc" }, take: 2, include: { variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 1 } } }),
    prisma.product.findMany({ where: { isPublished: true, isFeatured: true, category: { slug: { in: Object.keys(PLATFORMS) } } }, orderBy: { sortOrder: "asc" }, take: 3, include: { category: true, variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } }),
    prisma.review.findMany({ where: { status: "approved", onHome: true }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, rating: true, quote: true, name: true, city: true } }),
    prisma.newsArticle.findMany({ where: { isPublished: true }, orderBy: { publishedAt: "desc" }, take: 3, select: { slug: true, title: true, excerpt: true } }),
  ]);
  const home = normalizeHomepage(preview ? settings.homepageDraft : settings.homepage);
  const heroTitle = t(home.hero.title, locale) || th("heroTitle");
  const heroSubtitle = t(home.hero.subtitle, locale) || th("heroSubtitle");

  const orgJsonLd = { "@context": "https://schema.org", "@type": "Organization", name: settings.businessName, url: siteUrl(), address: settings.businessAddress };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(orgJsonLd) }} />
      {preview && <div className="bg-warning px-4 py-2 text-center text-sm font-semibold text-midnight">Preview of the unpublished homepage draft</div>}

      {Object.values(settings.serviceStatus ?? {}).some((s) => s !== "ok") ? (
        <Link href="/help" className="flex items-center gap-2 border-b border-[#FDE68A] bg-[#FFFBEB] px-4 py-[9px] text-xs font-bold text-[#92400E]">
          <span className="h-2 w-2 rounded-full bg-[#D97706]" />
          {tc("statusSome")}
        </Link>
      ) : (
        <Link href="/help" className="flex items-center gap-2 border-b border-[#DCFCE7] bg-[#F0FDF4] px-4 py-[9px] text-xs font-bold text-[#166534] dark:border-success-soft dark:bg-success-soft dark:text-success">
          <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
          {tc("statusOk")}
        </Link>
      )}

      <div className="mx-auto flex max-w-[560px] flex-col gap-5 px-5 py-[18px] md:max-w-3xl">
        <section className="relative flex flex-col gap-2.5 overflow-hidden rounded-[20px] bg-primary p-5 text-white">
          <div aria-hidden className="absolute -right-16 -top-16 h-[120px] w-[120px] rounded-full bg-[#D21034]" />
          {t(home.hero.eyebrow, locale) && <span className="relative max-w-[75%] text-xs font-extrabold tracking-[0.6px] text-[#DCE3FF]">{t(home.hero.eyebrow, locale)}</span>}
          <h1 className="relative max-w-[78%] text-[25px] font-extrabold leading-[1.15] md:max-w-none md:text-3xl">{heroTitle}</h1>
          <p className="relative text-sm leading-normal text-[#DCE3FF]">{heroSubtitle}</p>
          <PayBadges height={24} className="relative" />
          <Link href={home.ctaHref} className="relative flex min-h-12 items-center self-start rounded-xl bg-white px-[18px] text-[15px] font-bold text-[#0F172A]">{th("heroCta")}</Link>
        </section>

        {settings.trialEnabled && <Link href="/trial" className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-[#F59E0B] bg-surface p-3.5 text-text">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[#FEF3C7] text-[#B45309]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1.5S9 8 12 8c3 0 6-1 6-3.5S14 4 12 8z" /></svg>
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-extrabold">{th("trialTitle")}</span>
            <span className="text-xs text-muted">{th("trialBody")}</span>
          </span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="9 18 15 12 9 6" /></svg>
        </Link>}

        {home.sections.filter((x) => x.visible).map(({ id }) => {
          switch (id) {
            case "categories":
              return (
                <Fragment key={id}>
                <section className="flex flex-col gap-3">
                  <h2 className="text-base font-bold">{th("choosePlatform")}</h2>
                  <div className="grid grid-cols-3 gap-2.5 md:grid-cols-6">
                    {categories.map((c) => {
                      const info = PLATFORMS[c.slug];
                      return (
                        <Link key={c.id} href={`/order?platform=${c.slug}`} className="flex min-h-11 flex-col items-center gap-2 rounded-[14px] border border-border bg-surface px-1.5 py-3.5 text-text">
                          {c.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.image} alt="" className="h-[38px] w-[38px] rounded-[11px] object-cover" />
                          ) : (
                            <PlatformIcon slug={c.slug} color={info?.color} />
                          )}
                          <span className="text-[13px] font-semibold">{t(c.name, locale)}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>

                {settings.accountsEnabled && (
                  <Link href="/accounts" className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 text-text">
                    <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[#0F172A] text-white dark:bg-surface-2">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    </span>
                    <span className="flex flex-1 flex-col gap-0.5">
                      <span className="text-[15px] font-bold">{th("accountsTitle")}</span>
                      <span className="text-xs text-muted">{th("accountsText")}</span>
                    </span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="9 18 15 12 9 6" /></svg>
                  </Link>
                )}
                </Fragment>
              );
            case "featured":
              return (
                <Fragment key={id}>
                {packs.length > 0 && (
                  <section className="flex flex-col gap-2.5">
                    <div className="flex items-baseline justify-between">
                      <h2 className="text-base font-bold">{th("packsTitle")}</h2>
                      {(() => {
                        const v = packs[0].variants[0];
                        return v?.salePriceHtg ? <span className="text-xs font-bold text-[#B45309]">-{Math.round((1 - v.salePriceHtg / v.priceHtg) * 100)}%</span> : null;
                      })()}
                    </div>
                    <div className="flex gap-2.5">
                      {packs.map((p) => {
                        const v = p.variants[0];
                        const info = PLATFORMS[p.slug.split("-")[0]] ?? PLATFORMS[p.slug.startsWith("insta") ? "instagram" : "tiktok"];
                        return (
                          <Link key={p.id} href={`/order/pack/${p.slug}`} className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border border-border bg-surface p-3.5 text-text">
                            <span className="flex items-center gap-2">
                              <PlatformIcon slug={PLATFORMS[p.slug.split("-")[0]] ? p.slug.split("-")[0] : p.slug.startsWith("insta") ? "instagram" : "tiktok"} size={30} radius={9} color={p.accent ?? info?.color} />
                              <span className="text-sm font-extrabold">{t(p.name, locale)}</span>
                            </span>
                            <span className="whitespace-pre-line text-xs leading-normal text-muted">{t(p.description, locale)}</span>
                            {v && (
                              <span className="flex items-baseline gap-1.5">
                                <span className="text-base font-extrabold">{formatMoney(v.salePriceHtg ?? v.priceHtg, "HTG", locale)}</span>
                                {v.salePriceHtg && <span className="text-xs text-[#64748B] line-through">{formatMoney(v.priceHtg, "HTG", locale)}</span>}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                )}

                <section className="flex flex-col gap-2.5">
                  <h2 className="text-base font-bold">{th("popularTitle")}</h2>
                  {popular.map((p) => {
                    const tiers = p.variants.filter((v) => parseMeta(v.service));
                    const main = tiers[1] ?? tiers[0];
                    if (!main) return null;
                    const meta = parseMeta(main.service)!;
                    return (
                      <Link key={p.id} href={`/order?platform=${p.category.slug}&kind=${productKind(p.tags) ?? ""}`} className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-surface px-3.5 py-3 text-text">
                        <span className="flex flex-col gap-[3px]">
                          <span className="text-sm font-bold">{t(p.name, locale)}</span>
                          <span className="text-xs text-muted">{th("avgDelivery", { time: t(meta.avg, locale) })}</span>
                        </span>
                        <span className="whitespace-nowrap text-sm font-extrabold">{formatMoney(main.salePriceHtg ?? main.priceHtg, "HTG", locale)} {th("per1000")}</span>
                      </Link>
                    );
                  })}
                </section>
                </Fragment>
              );
            case "howItWorks":
              return (
                <section key={id} className="flex flex-col gap-2.5">
                  <h2 className="text-base font-bold">{th("howToPayTitle")}</h2>
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="flex items-start gap-3 rounded-[14px] border border-border bg-surface p-3.5">
                      <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-text text-sm font-extrabold text-surface">{n}</span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[15px] font-bold">{th(`step${n}Title`)}</span>
                        <span className="text-[13px] leading-snug text-muted">{th(`step${n}Body`)}</span>
                      </span>
                    </div>
                  ))}
                </section>
              );
            case "wallet":
              return (
                <section key={id} className="flex flex-col gap-2.5 rounded-[18px] bg-[#0F172A] p-5 text-white">
                  <h2 className="text-lg font-extrabold leading-snug">{th("walletTitle")}</h2>
                  <p className="text-sm leading-normal text-[#CBD5E1]">{th("walletBody")}</p>
                  <PayBadges height={22} />
                  <Link href="/account/wallet" className="flex min-h-12 items-center justify-center self-start rounded-xl bg-white px-[18px] text-[15px] font-bold text-[#0F172A]">{th("walletCta")}</Link>
                </section>
              );
            case "news":
              return news.length ? (
                <section key={id} className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-base font-bold">{th("newsTitle")}</h2>
                    <Link href="/news" className="flex min-h-11 items-center text-[13px] font-bold text-[#00209F] dark:text-primary">{tc("seeAll")} →</Link>
                  </div>
                  {news.map((a) => (
                    <Link key={a.slug} href={`/news/${a.slug}`} className="flex flex-col gap-1 rounded-[14px] border border-border bg-surface px-3.5 py-3 text-text">
                      <span className="text-sm font-bold">{t(a.title, locale)}</span>
                      {t(a.excerpt, locale) && <span className="line-clamp-2 text-xs leading-snug text-muted">{t(a.excerpt, locale)}</span>}
                    </Link>
                  ))}
                </section>
              ) : null;
            case "reviews":
              return reviews.length ? (
                <section key={id} className="flex flex-col gap-2.5">
                  <h2 className="text-base font-bold">{tt("reviewsTitle")} {tt("reviewsTitleAccent")}</h2>
                  <div className="-mx-5 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1">
                    {reviews.map((r) => (
                      <figure key={r.id} className="flex w-[78%] max-w-[300px] flex-none snap-start flex-col gap-2 rounded-[14px] border border-border bg-surface p-3.5">
                        <span className="text-sm text-[#B45309]" aria-label={tt("starsN", { n: r.rating })}>{"★".repeat(r.rating)}{"☆".repeat(Math.max(0, 5 - r.rating))}</span>
                        <blockquote className="text-sm leading-normal">“{r.quote}”</blockquote>
                        <figcaption className="text-xs font-semibold text-muted">{r.name}{r.city ? ` · ${r.city}` : ""}</figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              ) : null;
            case "trust":
              return (
                <section key={id} className="flex flex-col gap-2.5">
                  <h2 className="text-base font-bold">{th("trustTitle")}</h2>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(["Delivery", "Secure", "Support", "Local"] as const).map((k) => (
                      <div key={k} className="flex flex-col gap-1 rounded-[14px] border border-border bg-surface p-3.5">
                        <span className="text-sm font-bold">{th(`trust${k}`)}</span>
                        <span className="text-xs leading-snug text-muted">{th(`trust${k}Body`)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              );
            case "faq":
              return (
                <section key={id} className="flex flex-col gap-2.5">
                  <h2 className="text-base font-bold">{th("faqTitle")}</h2>
                  <div className="divide-y divide-border rounded-[14px] border border-border bg-surface">
                    {[1, 2, 3, 4].map((n) => (
                      <details key={n} className="group px-3.5">
                        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold">
                          {tf(`q${n}`)}
                          <span aria-hidden className="text-muted transition-transform group-open:rotate-45">+</span>
                        </summary>
                        <p className="pb-3.5 text-[13px] leading-normal text-muted">{tf(`a${n}`)}</p>
                      </details>
                    ))}
                  </div>
                  <Link href="/faq" className="flex min-h-11 items-center text-[13px] font-bold text-[#00209F] dark:text-primary">{tc("seeAll")} →</Link>
                </section>
              );
            default:
              return null;
          }
        })}
      </div>
    </>
  );
}
