import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { moncashAvailable } from "@/lib/payments/moncash";
import { DepositForm } from "@/components/DepositForm";
import { VerifyGate } from "@/components/VerifyGate";
import { mustVerifyEmail } from "@/lib/verify-email";
import { getManualMethods } from "@/lib/manual-methods";
import { Link } from "@/i18n/navigation";

export default async function DepositPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  if (await mustVerifyEmail(user.id)) return <VerifyGate email={user.email} />;
  const [tw, tc, s, manual] = await Promise.all([getTranslations("wallet"), getTranslations("common"), getSettings(), getManualMethods(locale, "deposits")]);
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/account/wallet" className="text-sm text-muted hover:text-text">← {tc("wallet")}</Link>
        <h1 className="display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{tw("depositTitle")}</h1>
      </div>
      <DepositForm
        moncash={moncashAvailable(s.moncashEnabled)}
        natcash={s.natcashEnabled}
        natcashName={s.natcashRecipientName}
        natcashPhone={s.natcashRecipientPhone}
        natcashQr={s.natcashQrUrl}
        manual={manual}
        minHtg={s.minDepositHtg}
        maxHtg={s.maxDepositHtg}
        htgPerUsd={s.htgPerUsd}
      />
      <p className="text-sm text-muted">{tw("storeCredit")}</p>
    </div>
  );
}
