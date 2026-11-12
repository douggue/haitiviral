import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "welcome" });
  return { title: t("title"), robots: { index: false } };
}

/** First screen after creating an account: a short welcome and the three things to do next. */
export default async function Welcome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const [t, settings] = await Promise.all([getTranslations("welcome"), getSettings()]);
  const steps = [
    ...(settings.trialEnabled ? [{ href: "/trial", emoji: "🎁", title: t("trialTitle"), sub: t("trialSub") }] : []),
    { href: "/account/wallet", emoji: "💳", title: t("walletTitle"), sub: t("walletSub") },
    { href: "/order", emoji: "🚀", title: t("orderTitle"), sub: t("orderSub") },
  ];
  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-4 px-5 py-6">
      <section className="flex flex-col gap-1.5 rounded-[18px] bg-[#0F172A] p-5 text-white">
        <span className="text-3xl" aria-hidden>👋</span>
        <h1 className="text-2xl font-extrabold">{t("hello", { name: user.name.split(" ")[0] || user.name })}</h1>
        <p className="text-sm leading-normal text-[#CBD5E1]">{t("intro")}</p>
      </section>
      <h2 className="text-base font-bold">{t("next")}</h2>
      <ol className="flex flex-col gap-2.5">
        {steps.map((s, i) => (
          <li key={s.href}>
            <Link href={s.href} className={`flex min-h-[64px] items-center gap-3 rounded-2xl border p-3.5 text-text ${i === 0 ? "border-2 border-[#0F172A] dark:border-text" : "border-border"} bg-surface`}>
              <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-surface-2 text-xl" aria-hidden>{s.emoji}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-bold">{i + 1}. {s.title}</span>
                <span className="text-[13px] leading-snug text-muted">{s.sub}</span>
              </span>
              <span aria-hidden className="text-muted">›</span>
            </Link>
          </li>
        ))}
      </ol>
      <Link href="/" className="flex min-h-11 items-center justify-center text-sm font-semibold text-muted">{t("later")}</Link>
    </div>
  );
}
