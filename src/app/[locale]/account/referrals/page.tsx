import { siteUrl } from "@/lib/site-url";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { ensureReferralCode } from "@/lib/referrals";
import { formatMoney } from "@/lib/money";
import { CopyButton } from "@/components/CopyButton";
import { PageBar } from "@/components/PageBar";
import { WhatsAppIcon } from "@/components/Icons";

/** Invite friends (mockup "Envite zanmi"): link, share buttons, counts, invited friends. */
export default async function ReferralsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const [t, tr, tc, settings] = await Promise.all([getTranslations("referralsUi"), getTranslations("referrals"), getTranslations("common"), getSettings()]);
  const bar = <PageBar title={tr("title")} back="/account" backLabel={tc("back")} />;
  if (!settings.referralEnabled) {
    return (
      <>
        {bar}
        <p className="mx-auto max-w-[560px] px-5 py-10 text-center text-muted">{t("off")}</p>
      </>
    );
  }
  const code = await ensureReferralCode(user.id);
  const link = `${siteUrl()}/${locale}?ref=${code}`;
  const shown = link.replace(/^https?:\/\//, "");
  const list = await prisma.referral.findMany({ where: { referrerId: user.id }, orderBy: { createdAt: "desc" }, include: { referred: { select: { name: true } } } });
  const earned = list.reduce((s, r) => s + (r.rewardAmount ?? 0), 0);
  const reward = formatMoney(settings.referralRewardHtg, "HTG", locale);
  const share = encodeURIComponent(tr("shareText", { link }));
  const mask = (name: string) => name.split(" ").map((p, i) => (i === 0 ? p : `${p[0] ?? ""}.`)).join(" ");

  return (
    <>
      {bar}
      <div className="mx-auto flex max-w-[560px] flex-col gap-[18px] px-5 py-[18px]">
        <section className="relative flex flex-col gap-2.5 overflow-hidden rounded-[20px] bg-primary p-5 text-white">
          <div aria-hidden className="absolute -right-9 -top-9 h-[130px] w-[130px] rounded-full bg-[#D21034]" />
          <p className="relative max-w-[250px] text-[22px] font-extrabold leading-tight">{t("headline", { reward })}</p>
          <p className="relative text-sm leading-normal text-[#DCE3FF]">{t("body", { reward, min: formatMoney(settings.referralMinOrderHtg, "HTG", locale) })}</p>
        </section>

        <section className="flex flex-col gap-2.5">
          <label htmlFor="reflink" className="text-sm font-bold">{t("yourLink")}</label>
          <div className="flex gap-2">
            <input id="reflink" readOnly value={shown} className="h-12 min-w-0 flex-1 rounded-xl border border-[#CBD2E1] bg-surface px-3 text-[15px] font-semibold dark:border-border" />
            <CopyButton value={link} label={t("copy")} done={t("copied")} icon={false} className="h-12 min-w-20 flex-none rounded-xl bg-text px-3 text-sm font-bold text-surface" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href={`https://wa.me/?text=${share}`} target="_blank" rel="noopener" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#15803D] text-sm font-bold text-white">
              <WhatsAppIcon width={18} height={18} />{t("whatsapp")}
            </a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`} target="_blank" rel="noopener" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] text-sm font-bold text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>{t("facebook")}
            </a>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2">
          {[
            [String(list.length), t("invited"), ""],
            [String(list.filter((r) => r.status === "REWARDED").length), t("active"), ""],
            [formatMoney(earned, "HTG", locale), t("earned"), "text-[#166534] dark:text-success"],
          ].map(([v, l, c]) => (
            <div key={l} className="flex flex-col items-center gap-1 rounded-[14px] border border-border bg-surface px-2.5 py-3 text-center">
              <span className={`text-xl font-extrabold ${c}`}>{v}</span>
              <span className="text-[11px] font-semibold text-muted">{l}</span>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold">{t("friends")}</h2>
          {list.length === 0 && <p className="py-3 text-sm text-muted">{t("none")}</p>}
          {list.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-border py-2.5">
              <span className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#E0E6FF] text-sm font-extrabold text-[#00209F]">{r.referred.name.trim()[0]?.toUpperCase() ?? "?"}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{mask(r.referred.name)}</span>
                  <span className="text-xs text-muted">{t(r.status)}</span>
                </span>
              </span>
              <span className={`text-sm font-bold ${r.status === "REWARDED" ? "text-[#166534] dark:text-success" : r.status === "REJECTED" ? "text-[#991B1B]" : "text-muted"}`}>
                {r.status === "REWARDED" ? `+ ${formatMoney(r.rewardAmount ?? 0, "HTG", locale)}` : r.status === "REJECTED" ? "—" : formatMoney(0, "HTG", locale)}
              </span>
            </div>
          ))}
        </section>
        <p className="text-xs leading-normal text-muted">{t("rules")}</p>
      </div>
    </>
  );
}
