import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ProfileForm } from "@/components/ProfileForm";
import { PageBar } from "@/components/PageBar";

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const u = await requireUser(locale);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
  const [tp, tc] = await Promise.all([getTranslations("profile"), getTranslations("common")]);
  return (
    <>
      <PageBar title={tp("title")} back="/account" backLabel={tc("back")} />
      <div className="mx-auto max-w-[560px] px-5 pb-8 pt-2 lg:mx-0 lg:max-w-xl lg:px-0">
      <ProfileForm user={{ name: user.name, email: user.email, phone: user.phone ?? "", locale: user.locale, displayCurrency: user.displayCurrency, city: user.city ?? "", showInFeed: user.showInFeed }} />
      </div>
    </>
  );
}
