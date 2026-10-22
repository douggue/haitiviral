import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getBalances } from "@/lib/ledger";
import { getSettings } from "@/lib/settings";
import { moncashAvailable } from "@/lib/payments/moncash";
import { getManualMethods } from "@/lib/manual-methods";
import { CheckoutForm } from "@/components/cart/CheckoutForm";
import { VerifyGate } from "@/components/VerifyGate";
import { mustVerifyEmail } from "@/lib/verify-email";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("title"), robots: { index: false } };
}

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/checkout`);
  if (await mustVerifyEmail(user.id)) return <div className="container-page py-8 sm:py-12"><VerifyGate email={user.email} /></div>;
  const [balances, settings, manualMethods] = await Promise.all([getBalances(prisma, user.id), getSettings(), getManualMethods(locale, "orders")]);
  return (
    <div className="container-page py-8 sm:py-12">
      <CheckoutForm
        balances={{ HTG: balances.HTG.available, USD: balances.USD.available }}
        moncashEnabled={moncashAvailable(settings.moncashEnabled)}
        natcashEnabled={settings.natcashEnabled}
        manualMethods={manualMethods}
      />
    </div>
  );
}
