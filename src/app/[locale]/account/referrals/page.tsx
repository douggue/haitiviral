import { siteUrl } from "@/lib/site-url";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { ensureReferralCode } from "@/lib/referrals";
import { formatMoney } from "@/lib/money";
import { CopyButton } from "@/components/CopyButton";
import { StatusBadge } from "@/components/StatusBadge";
import { WhatsAppIcon } from "@/components/Icons";

export default async function ReferralsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const [t, to, fmt, settings] = await Promise.all([getTranslations("referrals"), getTranslations("order"), getFormatter(), getSettings()]);
  if (!settings.referralEnabled) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="card mt-6 p-8 text-center text-muted">{t("off")}</p>
      </div>
    );
  }
  const code = await ensureReferralCode(user.id);
  const link = `${siteUrl()}/${locale}?ref=${code}`;
  const list = await prisma.referral.findMany({ where: { referrerId: user.id }, orderBy: { createdAt: "desc" }, include: { referred: { select: { name: true } } } });
  const earned = list.reduce((s, r) => s + (r.rewardAmount ?? 0), 0);
  const tone = { PENDING: "PENDING", REWARDED: "SUCCEEDED", REJECTED: "CANCELED" } as const;
  const mask = (name: string) => name.split(" ").map((p, i) => (i === 0 ? p : `${p[0] ?? ""}.`)).join(" ");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">{t("intro", { reward: formatMoney(settings.referralRewardHtg, "HTG", locale), min: formatMoney(settings.referralMinOrderHtg, "HTG", locale) })}</p>
      </div>
      <section className="card space-y-3 p-5">
        <p className="label">{t("yourLink")}</p>
        <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
          <code className="flex-1 break-all text-sm font-semibold">{link}</code>
          <CopyButton value={link} label={to("copy")} done={to("copied")} />
        </div>
        <a href={`https://wa.me/?text=${encodeURIComponent(t("shareText", { link }))}`} target="_blank" rel="noopener" className="btn min-h-11 bg-[#1fa855] text-white hover:bg-[#178a45]"><WhatsAppIcon width={18} height={18} /> {t("share")}</a>
      </section>
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4"><p className="text-xs text-muted">{t("invited")}</p><p className="text-2xl font-bold">{list.length}</p></div>
        <div className="card p-4"><p className="text-xs text-muted">{t("rewarded")}</p><p className="text-2xl font-bold">{list.filter((r) => r.status === "REWARDED").length}</p></div>
        <div className="card p-4"><p className="text-xs text-muted">{t("earned")}</p><p className="text-xl font-bold">{formatMoney(earned, "HTG", locale)}</p></div>
      </div>
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">{t("history")}</h2>
        {list.length === 0 ? <p className="py-4 text-center text-sm text-muted">{t("none")}</p> : (
          <ul className="divide-y divide-border text-sm">
            {list.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <span>{mask(r.referred.name)} <span className="text-xs text-muted">· {fmt.dateTime(r.createdAt, { dateStyle: "medium" })}</span></span>
                <StatusBadge status={tone[r.status]} label={t(`status${r.status}`)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
