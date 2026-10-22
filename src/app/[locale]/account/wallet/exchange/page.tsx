import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getBalances } from "@/lib/ledger";
import { getSettings } from "@/lib/settings";
import { ExchangeForm } from "@/components/ExchangeForm";
import { VerifyGate } from "@/components/VerifyGate";
import { mustVerifyEmail } from "@/lib/verify-email";
import { Link } from "@/i18n/navigation";

export default async function ExchangePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  if (await mustVerifyEmail(user.id)) return <VerifyGate email={user.email} />;
  const [tw, tc, b, s] = await Promise.all([getTranslations("wallet"), getTranslations("common"), getBalances(prisma, user.id), getSettings()]);
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/account/wallet" className="text-sm text-muted hover:text-text">← {tc("wallet")}</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{tw("exchangeTitle")}</h1>
      </div>
      <ExchangeForm balances={{ HTG: b.HTG.available, USD: b.USD.available }} midRate={s.htgPerUsd} />
    </div>
  );
}
