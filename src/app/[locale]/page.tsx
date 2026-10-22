import { siteUrl } from "@/lib/site-url";
import { Fragment } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/session";
import { isStaff } from "@/lib/permissions";
import { normalizeHomepage } from "@/lib/homepage";
import { pageSeo } from "@/lib/seo";
import { NewsCard } from "@/components/NewsCard";
import { Link } from "@/i18n/navigation";
import { getCategories, searchProducts } from "@/lib/catalog";
import { fullTheme, getDisplaySettings } from "@/lib/settings";
import { t } from "@/lib/text";
import Image from "next/image";
import { ProductCard } from "@/components/ProductCard";
import { CategoryCard } from "@/components/CategoryCard";
import { HaitiEyebrow } from "@/components/HaitiEyebrow";
import { ReviewsSection } from "@/components/ReviewsSection";
import { ArrowRightIcon, BoltIcon, ChatIcon, PinIcon, ShieldIcon, WalletIcon } from "@/components/Icons";
import { PayLogo } from "@/components/PayLogo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageSeo(locale, "/", "");
}


/** Gaming icons between the words of the scrolling band (drawn, so they look the same on every phone). */
const MARQUEE_ICONS = [
  // gamepad
  "M6 9h4M8 7v4M15 10h.01M18 12h.01M7.5 5h9A5.5 5.5 0 0 1 22 10.5v3a3.5 3.5 0 0 1-6.3 2.1L14.5 14h-5l-1.2 1.6A3.5 3.5 0 0 1 2 13.5v-3A5.5 5.5 0 0 1 7.5 5Z",
  // diamond
  "M6 3h12l4 6-10 12L2 9Z M2 9h20 M12 21 8 9l4-6 4 6Z",
  // trophy
  "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z M17 6h3a3 3 0 0 1-3 4 M7 6H4a3 3 0 0 0 3 4",
  // lightning
  "M13 2 4 14h7l-1 8 9-12h-7Z",
];
const MARQUEE_COLORS = ["#FFB020", "#2EE6A8", "#FF5DA2", "#46D8FF"];
function MarqueeIcon({ n }: { n: number }) {
  const color = MARQUEE_COLORS[n % MARQUEE_COLORS.length];
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/25 shadow-inner ring-1 ring-white/20" style={{ color }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
        <path d={MARQUEE_ICONS[n % MARQUEE_ICONS.length]} />
      </svg>
    </span>
  );
}
export default async function HomePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const viewer = sp.preview ? await getUser() : null;
  const preview = !!viewer && isStaff(viewer.role) && !!viewer.twoFactorEnabled;
  const [th, tc, tf, featured, categories, settings, news] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getTranslations("faq"),
    searchProducts({ featured: true, take: 8 }),
    getCategories(),
    getDisplaySettings(),
    prisma.newsArticle.findMany({ where: { isPublished: true, publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" }, take: 3 }),
  ]);
  const home = normalizeHomepage(preview ? settings.homepageDraft : settings.homepage);

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.businessName,
    url: siteUrl(),
    address: settings.businessAddress,
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [1, 2, 3, 4].map((i) => ({
      "@type": "Question",
      name: tf(`q${i}`),
      acceptedAnswer: { "@type": "Answer", text: tf(`a${i}`) },
    })),
  };

  const marquee = (fullTheme(settings.theme).marquee[locale] ?? "").split(",").map((w) => w.trim()).filter(Boolean).slice(0, 12);

  const heroText = (k: "eyebrow" | "title" | "subtitle") =>
    t(home.hero[k], locale) || th(k === "eyebrow" ? "eyebrow" : k === "title" ? "heroTitle" : "heroSubtitle");

  const blocks: Record<string, React.ReactNode> = {
    categories: (
      <>
<section className="container-page mt-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="display text-2xl font-bold tracking-tight sm:text-3xl">{th("categoriesTitle")}</h2>
          <Link href="/categories" className="text-sm font-semibold text-primary">{tc("viewAll")}</Link>
        </div>
        <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {categories.map((c, i) => (
            <CategoryCard key={c.id} href={`/categories/${c.slug}`} name={t(c.name, locale)} count={`${c._count.products} ${tc("products")}`} cover={c.cover} image={c.image} icon={c.icon} index={i} />
          ))}
        </div>
      </section>
      </>
    ),
    featured: (
      <>
<section className="container-page mt-14">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="display text-2xl font-bold tracking-tight sm:text-3xl">{th("featured")}</h2>
          <Link href="/store" className="text-sm font-semibold text-primary">{tc("viewAll")}</Link>
        </div>
        <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
      </>
    ),
    howItWorks: (
      <>
<section className="container-page mt-16">
        <div className="card overflow-hidden p-6 sm:p-10">
          <h2 className="display text-2xl font-bold tracking-tight sm:text-3xl">{th("howToPayTitle")}</h2>
          <p className="mt-1 text-muted">{th("howToPaySubtitle")}</p>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <li key={i} className="flex flex-col gap-2">
                <span className="display text-4xl font-bold text-primary" aria-hidden>0{i}</span>
                <h3 className="text-lg font-bold">{th(`step${i}Title`)}</h3>
                <p className="text-sm text-muted">{th(`step${i}Body`)}</p>
              </li>
            ))}
          </ol>
          <Link href="/guides" className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            {th("payGuideLink")} <ArrowRightIcon width={16} height={16} />
          </Link>
        </div>
      </section>
      </>
    ),
    wallet: (
      <>
<section className="container-page mt-6">
        <div className="relative flex flex-col items-start gap-5 overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#3b7dff,#1f56d8_45%,#0d2a78)] p-6 text-white shadow-[0_26px_50px_-24px_var(--glow)] sm:flex-row sm:items-center sm:p-8">
          <span aria-hidden className="ds-hide pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[#46d8ff]/40 blur-3xl" />
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20"><WalletIcon /></span>
          <div className="relative flex-1">
            <h2 className="display text-xl font-bold sm:text-2xl">{th("walletTitle")}</h2>
            <p className="mt-1 text-sm text-[#dbe7ff]">{th("walletBody")}</p>
          </div>
          <Link href="/account/wallet" className="btn relative bg-white text-[#0d2a78] hover:bg-[#e6efff]">{th("walletCta")}</Link>
        </div>
      </section>
      </>
    ),
    reviews: <ReviewsSection locale={locale} />,
    trust: (
      <>
<section className="container-page mt-16">
        <h2 className="display text-2xl font-bold tracking-tight sm:text-3xl">{th("trustTitle")}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [BoltIcon, "trustDelivery"],
            [ShieldIcon, "trustSecure"],
            [ChatIcon, "trustSupport"],
            [PinIcon, "trustLocal"],
          ].map(([Icon, key]) => {
            const I = Icon as typeof BoltIcon;
            const k = key as string;
            return (
              <div key={k} className="card p-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary"><I /></span>
                <h3 className="mt-3 font-semibold">{th(k)}</h3>
                <p className="mt-1 text-sm text-muted">{th(`${k}Body`)}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-muted">
          {settings.businessName} · {settings.businessAddress} · {settings.supportHours}
        </p>
      </section>
      </>
    ),
    faq: (
      <>
<section className="container-page mt-16">
        <h2 className="display text-2xl font-bold tracking-tight sm:text-3xl">{th("faqTitle")}</h2>
        <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
          {[1, 2, 3, 4].map((i) => (
            <details key={i} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {tf(`q${i}`)}
                <span className="text-muted transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 text-sm text-muted">{tf(`a${i}`)}</p>
            </details>
          ))}
        </div>
      </section>
      </>
    ),
    news: news.length > 0 ? (
      <section className="container-page mt-16">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="display text-2xl font-bold tracking-tight sm:text-3xl">{th("newsTitle")}</h2>
          <Link href="/news" className="text-sm font-semibold text-primary">{tc("viewAll")}</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {news.map((n) => <NewsCard key={n.id} article={n} locale={locale} />)}
        </div>
      </section>
    ) : null,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([orgJsonLd, faqJsonLd]) }} />

      {preview && (
        <div className="bg-warning px-4 py-2 text-center text-sm font-semibold text-midnight">Preview of the unpublished homepage draft</div>
      )}
      {/* Hero (always first, always dark) */}
      <section className="hero-dark relative overflow-hidden">
        <div className="hero-grid" aria-hidden />
        <div className="container-page relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="stagger flex flex-col gap-5">
            <HaitiEyebrow text={heroText("eyebrow")} />
            <h1 className="display neon-text animate-rise text-4xl font-bold leading-[1.04] sm:text-5xl lg:text-6xl">{heroText("title")}</h1>
            <p className="animate-rise max-w-xl text-base text-[#b7c6e4] sm:text-lg">{heroText("subtitle")}</p>
            <div className="animate-rise flex flex-wrap gap-3">
              <Link href={home.ctaHref || "/store"} className="btn-primary glow-btn neon-pulse min-h-13 px-6 text-base">
                {tc("shopNow")} <ArrowRightIcon width={18} height={18} />
              </Link>
              <Link href="/categories" className="btn min-h-13 border border-white/25 px-6 text-base text-white hover:bg-white/10">
                {tc("browseCategories")}
              </Link>
            </div>
            <div className="animate-rise flex flex-wrap items-center gap-3 text-sm text-[#b7c6e4]">
              <PayLogo brand="moncash" height={25} />
              <PayLogo brand="natcash" height={25} />
              <Link href="/guides" className="underline-offset-4 hover:text-white hover:underline">{th("payGuideLink")}</Link>
            </div>
          </div>
          {settings.heroImageUrl ? (
            <div className="ds-hide animate-rise relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
              <Image src={settings.heroImageUrl} alt="" fill priority sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
            </div>
          ) : (
            <div className="relative hidden h-[400px] lg:block" aria-hidden>
              <div className="animate-rise absolute right-6 top-2 flex h-[340px] w-[280px] rotate-3 flex-col justify-end rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_50%_35%,#ff9a3c,#c2341d_45%,#3a0e18)] p-6 shadow-[0_30px_80px_-30px_rgba(255,120,60,.6)]">
                <span className="display text-6xl font-bold leading-none">{featured[0] ? t(featured[0].name, locale).slice(0, 2).toUpperCase() : "HG"}</span>
                <span className="mt-3 font-bold">{featured[0] ? t(featured[0].name, locale) : "Haiti Gaming"}</span>
                <span className="text-sm opacity-80">{th("trustDelivery")}</span>
              </div>
              <div className="animate-rise absolute left-0 top-16 flex w-60 flex-col gap-2 rounded-2xl border border-[#46d8ff]/35 bg-[#0e1830]/90 p-4 shadow-[0_0_40px_-12px_rgba(70,216,255,.6)] backdrop-blur">
                <span className="text-xs font-semibold text-[#8fa3c8]">{tc("codeReady")}</span>
                <span className="font-mono text-sm tracking-wider text-[#46d8ff]">XXXX-XXXX-XXXX</span>
                <span className="flex items-center gap-1.5 text-sm font-bold text-[#2fd27f]"><BoltIcon width={16} height={16} /> {th("trustDelivery")}</span>
              </div>
              <div className="animate-rise absolute bottom-0 left-0 flex w-52 flex-col gap-1 rounded-2xl bg-[linear-gradient(135deg,#2f74ff,#1340a8)] p-4 shadow-[0_24px_50px_-20px_rgba(47,116,255,.9)]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#cfe0ff]">{tc("wallet")}</span>
                <span className="text-2xl font-extrabold">HTG · USD</span>
                <span className="text-sm text-[#cfe0ff]">{th("walletTitle")}</span>
              </div>
            </div>
          )}
        </div>
      </section>
      {marquee.length > 0 && (
        <div className="marquee marquee-color text-white" aria-hidden>
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="display flex shrink-0 items-center gap-8 py-3.5 pr-8 text-lg font-bold sm:text-xl">
                {marquee.map((w, i) => (
                  <Fragment key={i}><span className="whitespace-nowrap">{w}</span><MarqueeIcon n={i} /></Fragment>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {home.sections.filter((x) => x.visible).map((x) => <Fragment key={x.id}>{blocks[x.id]}</Fragment>)}
    </>
  );
}
