import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { DeleteAccountForm } from "@/components/PrivacyForms";
import { PageBar } from "@/components/PageBar";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const hasPassword = (await prisma.account.count({ where: { userId: user.id, providerId: "credential" } })) > 0;
  const [t, tc] = await Promise.all([getTranslations("privacy"), getTranslations("common")]);
  return (
    <>
    <PageBar title={t("title")} back="/account" backLabel={tc("back")} />
    <div className="mx-auto max-w-[560px] space-y-6 px-5 pb-8 pt-2 lg:mx-0 lg:max-w-xl lg:px-0">
      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">{t("exportTitle")}</h2>
        <p className="text-sm text-muted">{t("exportBody")}</p>
        <a href="/api/account/export" className="btn-secondary">{t("exportButton")}</a>
      </section>
      <DeleteAccountForm hasPassword={hasPassword} />
    </div>
    </>
  );
}
