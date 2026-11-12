import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/session";
import { getDisplaySettings } from "@/lib/settings";
import { t as txt } from "@/lib/text";
import { PayBadges } from "@/components/PayLogo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "invite" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/**
 * Short invite link haitiviral.com/r/CODE: a welcome page for the friend (who invited them, the free trial, sign up).
 * The code is remembered by the middleware, so the invite counts even if they sign up later.
 */
export default async function Invite({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code: raw } = await params;
  setRequestLocale(locale);
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const [t, user, s, inviter] = await Promise.all([
    getTranslations("invite"),
    getUser(),
    getDisplaySettings(),
    code ? prisma.user.findUnique({ where: { referralCode: code }, select: { name: true, status: true } }) : null,
  ]);
  // Already a customer: the invite is not for them; their own referral page is.
  if (user) redirect(`/${locale}/account/referrals`);
  const who = inviter && inviter.status === "ACTIVE" ? inviter.name.trim().split(/\s+/)[0] : null;
  const next = s.trialEnabled ? "/trial" : "/order";
  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-5 px-5 pb-8 pt-5">
      <section className="relative flex flex-col gap-3 overflow-hidden rounded-[22px] bg-[#00209F] px-5 py-6 text-white">
        <div aria-hidden className="absolute -right-14 -top-14 h-[130px] w-[130px] rounded-full bg-[#D21034] opacity-90" />
        <span className="relative text-3xl" aria-hidden>🎉</span>
        <h1 className="relative max-w-[85%] text-[26px] font-extrabold leading-[1.2]">{who ? t("titleFrom", { name: who }) : t("title")}</h1>
        <p className="relative text-[15px] leading-normal text-[#E5EAFF]">{t("lead")}</p>
        <Link href={`/auth/register?next=${encodeURIComponent(next)}`} className="relative flex min-h-[52px] items-center justify-center rounded-[14px] bg-white text-base font-extrabold text-[#00209F] dark:bg-white dark:text-[#00209F]">
          {s.trialEnabled ? t("ctaTrial") : t("ctaJoin")}
        </Link>
        <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="relative flex min-h-11 items-center justify-center text-sm font-bold text-[#DCE3FF]">{t("haveAccount")}</Link>
      </section>

      {s.trialEnabled && s.trialOffers.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-lg font-extrabold">{t("trialTitle")}</h2>
          <ul className="flex flex-col gap-2">
            {s.trialOffers.map((o) => (
              <li key={o.key} className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-surface px-3.5 py-3">
                <span className="text-[15px] font-bold">🎁 {txt(o.label, locale)}</span>
                <span className="text-xs text-muted">{t("avg", { time: txt(o.avg, locale) })}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{t("trialNote")}</p>
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <h2 className="text-lg font-extrabold">{t("howTitle")}</h2>
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-start gap-3 rounded-[14px] border border-border bg-surface p-3.5">
            <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-text text-[15px] font-extrabold text-surface">{n}</span>
            <span className="text-[14px] leading-snug">{t(`step${n}`)}</span>
          </div>
        ))}
        <PayBadges height={24} />
      </section>
    </div>
  );
}
