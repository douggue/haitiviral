"use client";
import { useTranslations } from "next-intl";
import { WhatsAppIcon } from "./Icons";
import { CopyButton } from "./CopyButton";

/** "Send it to the person": opens WhatsApp with the gift message ready; the buyer picks the contact. */
export function GiftShare({ text, hasNote }: { text: string; hasNote: boolean }) {
  const t = useTranslations("gift");
  return (
    <section className="card border-primary/40 p-5">
      <h2 className="font-semibold">🎁 {t("shareTitle")}</h2>
      <p className="mt-1 text-sm text-muted">{hasNote ? t("shareBodyNote") : t("shareBody")}</p>
      <p className="mt-3 whitespace-pre-wrap rounded-xl bg-surface-2 px-4 py-3 text-sm">{text}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener" className="btn-primary min-h-11 !bg-[#1fa855] hover:!bg-[#178a45]">
          <WhatsAppIcon width={18} height={18} /> {t("shareButton")}
        </a>
        <CopyButton value={text} label={t("copy")} done={t("copied")} />
      </div>
    </section>
  );
}
