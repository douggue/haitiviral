"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { CopyButton } from "./CopyButton";

/** One gift item: the code stays hidden until the receiver taps "Show the code" (no peeking over shoulders / in previews). */
export function GiftReveal({ title, codes }: { title: string; codes: string[] }) {
  const t = useTranslations("gift");
  const to = useTranslations("order");
  const [shown, setShown] = useState(false);
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="font-semibold">{title}</p>
      {codes.length === 0 ? (
        <p className="mt-1 text-sm text-muted">{t("deliveredToAccount")}</p>
      ) : shown ? (
        <ul className="mt-3 space-y-2">
          {codes.map((c) => (
            <li key={c} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
              <code className="break-all font-mono text-sm font-semibold">{c}</code>
              <CopyButton value={c} label={to("copy")} done={to("copied")} />
            </li>
          ))}
        </ul>
      ) : (
        <button type="button" onClick={() => setShown(true)} className="btn-primary mt-3 min-h-11 w-full">{t("reveal")}</button>
      )}
    </div>
  );
}
