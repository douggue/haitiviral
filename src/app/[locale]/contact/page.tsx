import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContentPage } from "@/components/ContentPage";
import { Link } from "@/i18n/navigation";
import { pageSeo } from "@/lib/seo";
import { getDisplaySettings } from "@/lib/settings";
import { getUser } from "@/lib/session";
import { WhatsAppIcon } from "@/components/Icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return pageSeo(locale, "/contact", t("contactTitle"));
}

/** Contact: WhatsApp first, then a support request (tied to an order), hours and address, and quick answers. */
export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const [t, tc, ta, s, user] = await Promise.all([getTranslations("pages"), getTranslations("common"), getTranslations("contactUi"), getDisplaySettings(), getUser()]);
  return (
    <ContentPage title={t("contactTitle")}>
      <p className="text-muted">{t("contactBody")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={`https://wa.me/${s.whatsappNumber}?text=${encodeURIComponent(tc("whatsappMessage"))}`} target="_blank" rel="noopener" className="btn min-h-12 bg-[#15803D] text-white hover:bg-[#166534]">
          <WhatsAppIcon /> {tc("whatsappHelp")}
        </a>
        <Link href={user ? "/account/support" : "/auth/login?next=/account/support"} className="btn-secondary min-h-12">{ta("ticket")}</Link>
      </div>
      <p className="text-sm text-muted">{ta("ticketHint")}</p>
      <dl className="card grid gap-4 p-5 sm:grid-cols-2">
        <div><dt className="text-sm text-muted">{t("hours")}</dt><dd className="font-medium">{s.supportHours}</dd></div>
        <div><dt className="text-sm text-muted">WhatsApp</dt><dd className="font-medium">+{s.whatsappNumber}</dd></div>
        <div className="sm:col-span-2"><dt className="text-sm text-muted">{t("address")}</dt><dd className="font-medium">{s.businessName}, {s.businessAddress}</dd></div>
      </dl>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold">{ta("quickTitle")}</h2>
        <Link href="/help" className="flex min-h-11 items-center text-sm font-semibold text-primary">{ta("quickHelp")} →</Link>
        <Link href="/faq" className="flex min-h-11 items-center text-sm font-semibold text-primary">{ta("quickFaq")} →</Link>
        <Link href="/refunds" className="flex min-h-11 items-center text-sm font-semibold text-primary">{ta("quickRefunds")} →</Link>
      </div>
    </ContentPage>
  );
}
