import { unstable_cache } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Settings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { t as txt } from "@/lib/text";
import { DataSaverToggle } from "./DataSaverToggle";
import { InstallLink } from "./InstallPrompt";
import { NewsletterForm } from "./NewsletterForm";
import { PayBadges } from "./PayLogo";
import { DEFAULT_FOOTER_HELP, DEFAULT_FOOTER_SERVICES } from "@/lib/footer-links";

const footerPages = unstable_cache(
  () => prisma.page.findMany({ where: { isPublished: true, showInFooter: true }, select: { slug: true, title: true }, orderBy: { createdAt: "asc" } }),
  ["footer-pages"],
  { tags: ["pages"], revalidate: 300 },
);

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ICONS: Record<string, React.ReactNode> = {
  whatsapp: <path {...stroke} d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z" />,
  telegram: <path {...stroke} d="M21.5 4.5 2.5 11.8l6.3 2.1 2.3 6.6 3.4-4.4 5 3.7z M8.8 13.9 18 7.5" />,
  facebook: <path {...stroke} d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  tiktok: <path {...stroke} d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.5 2.5 4.5 5 4.5" />,
  instagram: <g {...stroke}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" /></g>,
  youtube: <g {...stroke}><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="m10 9 5 3-5 3z" /></g>,
  google: <path {...stroke} d="M20.5 12.2c0 4.8-3.3 8.3-8.3 8.3a8.5 8.5 0 1 1 5.7-14.8M20.5 12.2H12.3" />,
  trustpilot: <path {...stroke} d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5l-5.3 2.9 1.2-6-4.5-4.1 6-.7z" />,
};

/**
 * Footer (dark navy, same on every page and in both themes): brand, short text, service chips, help chips,
 * payment logos, round social buttons, copyright and legal links. Colours are fixed on purpose (not the theme).
 */
export async function Footer({ settings }: { settings: Settings }) {
  const t = await getTranslations("common");
  const locale = await getLocale();
  const pages = await footerPages();
  const extra = settings.navigation?.footer ?? [];
  const chip = "inline-flex min-h-11 items-center rounded-full border border-[#24357A] bg-[#111C47] px-4 text-[15px] font-bold text-[#7B95FF] hover:bg-[#16245C]";
  const label = "text-xs font-extrabold uppercase tracking-[1.6px] text-[#475176]";
  // Admin → Menus; the standard lists while staff haven't made their own.
  const pick = (list: { href: string; label: Record<string, string> }[] | undefined, fallback: typeof DEFAULT_FOOTER_SERVICES) =>
    (list?.length ? list : fallback).map((l) => ({ href: l.href, label: txt(l.label, locale), external: l.href.startsWith("https://") }));
  const services = pick(settings.navigation?.footerServices, DEFAULT_FOOTER_SERVICES);
  const help = pick(settings.navigation?.footerHelp, DEFAULT_FOOTER_HELP);
  const socials = [
    ["whatsapp", settings.socialWhatsappChannel || `https://wa.me/${settings.whatsappNumber}`, "WhatsApp"], ["instagram", settings.socialInstagram, "Instagram"],
    ["tiktok", settings.socialTiktok, "TikTok"], ["facebook", settings.socialFacebook, "Facebook"], ["youtube", settings.socialYoutube, "YouTube"],
    ["telegram", settings.socialTelegram, "Telegram"], ["google", settings.reviewsGoogle, "Google"], ["trustpilot", settings.reviewsTrustpilot, "Trustpilot"],
  ].filter(([, url]) => url);
  const legal: { href: string; label: string; external?: boolean }[] = [
    { href: "/terms", label: t("terms") }, { href: "/privacy", label: t("privacy") }, { href: "/refunds", label: t("refunds") },
    ...pages.map((p) => ({ href: `/p/${p.slug}`, label: txt(p.title, locale) })),
    ...extra.map((l) => ({ href: l.href, label: txt(l.label, locale), external: l.href.startsWith("https://") })),
  ];
  const name = settings.businessName || "HaitiViral";
  const split = /viral$/i.test(name) ? [name.slice(0, -5), name.slice(-5)] : [name, ""];

  return (
    <footer className="mt-12 bg-gradient-to-br from-[#0B1224] to-[#0D1A3E] text-[#E2E8F0]">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-7 px-5 pb-8 pt-10 md:px-8">
        <div className="flex flex-col gap-3">
          <p className="font-display text-[28px] font-black uppercase leading-none tracking-[0.5px] text-white">
            {split[0]}<span className="text-[#FF4D6D]">{split[1]}</span>
          </p>
          <p className="max-w-[460px] text-[15px] leading-relaxed text-[#8A93B2]">{t("footerTagline")}</p>
        </div>

        <nav aria-label={t("ourServices")} className="flex flex-col gap-3">
          <h2 className={label}>{t("ourServices")}</h2>
          <div className="flex flex-wrap gap-2.5">
            {services.map((l) => (l.external
              ? <a key={l.href} href={l.href} target="_blank" rel="noopener" className={chip}>{l.label}</a>
              : <Link key={l.href} href={l.href} className={chip}>{l.label}</Link>))}
          </div>
        </nav>

        <nav aria-label={t("help")} className="flex flex-col gap-3">
          <h2 className={label}>{t("help")}</h2>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[15px] font-semibold text-[#AEB7D4]">
            {help.map((l) => (l.external
              ? <a key={l.href} href={l.href} target="_blank" rel="noopener" className="py-1 hover:text-white">{l.label}</a>
              : <Link key={l.href} href={l.href} className="py-1 hover:text-white">{l.label}</Link>))}
            <span className="py-1 text-[#6B7393]">{t("hoursShort")}: {settings.supportHours}</span>
          </div>
        </nav>

        <PayBadges />

        {settings.newsletterEnabled && <NewsletterForm />}

        <div className="h-px bg-[#1E2A4D]" />

        {socials.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {socials.map(([key, url, title]) => (
              <a key={key} href={url} target="_blank" rel="noopener noreferrer" aria-label={title} title={title}
                className="grid h-12 w-12 place-items-center rounded-full border border-[#2A3557] bg-[#151E36] text-[#7C86A6] hover:text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>{ICONS[key]}</svg>
              </a>
            ))}
          </div>
        )}

        <p className="text-sm text-[#4E5878]">© {new Date().getFullYear()} {name} — {t("rights")}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] text-[#C7CEE3]">
          <span aria-hidden>📄</span>
          {legal.map((l) => l.external
            ? <a key={l.href} href={l.href} target="_blank" rel="noopener" className="border-b border-dashed border-[#5A6488] pb-0.5 hover:text-white">{l.label}</a>
            : <Link key={l.href} href={l.href} className="border-b border-dashed border-[#5A6488] pb-0.5 hover:text-white">{l.label}</Link>)}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#8A93B2] [&_*]:!text-[#8A93B2]"><DataSaverToggle /><InstallLink /></div>
      </div>
    </footer>
  );
}
