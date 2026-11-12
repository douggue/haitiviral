"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { reportClientError } from "@/lib/client-report";

/** Something broke on this page: say it plainly, offer to try again, go home, or ask for help (with the reference). */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorUi");
  useEffect(() => reportClientError(error), [error]);
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-5 py-12 text-center">
      <div className="flex w-full flex-col items-center gap-3">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-[#FEF3C7] text-3xl" aria-hidden>⚠️</span>
        <h1 className="text-xl font-extrabold">{t("title")}</h1>
        <p className="text-sm leading-normal text-muted">{t("body")}</p>
        <div className="mt-2 flex w-full flex-col gap-2.5">
          <button type="button" className="btn-primary min-h-12 w-full" onClick={reset}>{t("retry")}</button>
          <Link href="/" className="btn-secondary min-h-12 w-full">{t("home")}</Link>
          <Link href="/contact" className="flex min-h-11 items-center justify-center text-sm font-semibold text-primary">{t("help")}</Link>
        </div>
        {error.digest && <p className="font-mono text-xs text-muted">{t("ref")}: {error.digest}</p>}
      </div>
    </div>
  );
}
