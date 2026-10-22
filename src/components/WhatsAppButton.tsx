import { getTranslations } from "next-intl/server";
import { WhatsAppIcon } from "./Icons";

export async function WhatsAppButton({ number, message }: { number: string; message?: string }) {
  const t = await getTranslations("common");
  const text = encodeURIComponent(message ?? t("whatsappMessage"));
  return (
    <a
      href={`https://wa.me/${number}?text=${text}`}
      target="_blank"
      rel="noopener"
      style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}
      className="kb-hide fixed right-4 z-30 md:!bottom-6 md:right-6 inline-flex h-14 items-center gap-2 rounded-full bg-[#1fa855] px-4 font-semibold text-white shadow-lg shadow-black/20 hover:bg-[#178a45]"
      aria-label={t("whatsappHelp")}
    >
      <WhatsAppIcon />
      <span className="hidden sm:inline">{t("help")}</span>
    </a>
  );
}
