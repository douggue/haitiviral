"use client";
import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { submitTrial, trialStatus } from "@/actions/trial";
import { checkLink, linkExample, PLATFORMS } from "@/lib/services";
import { getFingerprint, getLocalId } from "@/lib/device-client";
import { Turnstile, turnstileOn } from "./Turnstile";

type Offer = { key: string; label: string; avg: string; platform: string; post: boolean };
type Sent = { status: string; code: string | null; wa: string | null };

/**
 * Free trial (mockup "Eseye gratis"): pick the trial, paste the link, then confirm the phone by sending a code
 * on WhatsApp (when WhatsApp is set up; otherwise the number is typed). Then: sent, being checked, or refused.
 */
export function TrialForm({ offers, signedIn, whatsapp, existing }: { offers: Offer[]; signedIn: boolean; whatsapp: boolean; existing: Sent | null }) {
  const t = useTranslations("trialUi");
  const locale = useLocale();
  const [pick, setPick] = useState(0);
  const [link, setLink] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState<Sent | null>(existing);
  const [captcha, setCaptcha] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [pending, start] = useTransition();
  const waiting = sent?.status === "AWAITING_PHONE";

  // While waiting for the WhatsApp message, check every few seconds.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(async () => {
      const st = await trialStatus();
      if (st && st !== "AWAITING_PHONE") setSent((s) => (s ? { ...s, status: st } : s));
    }, 4000);
    return () => clearInterval(timer);
  }, [waiting]);

  const cur = offers[pick];
  if (!cur) return null;
  const linkBad = link.trim() !== "" && !checkLink(link, cur.platform, cur.post).ok;

  if (sent && waiting) {
    return (
      <div className="flex flex-col gap-4 py-2">
        <p className="text-[22px] font-extrabold">{t("waTitle")}</p>
        <p className="text-sm leading-normal text-text/80">{t("waBody")}</p>
        <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-[#CBD2E1] bg-surface p-5 dark:border-border">
          <span className="text-xs font-bold uppercase tracking-[0.6px] text-muted">{t("waCode")}</span>
          <span className="font-mono text-[34px] font-extrabold tracking-[3px]">{sent.code}</span>
        </div>
        <a href={sent.wa ?? "#"} target="_blank" rel="noopener noreferrer" className="flex h-[54px] items-center justify-center gap-2 rounded-[14px] bg-[#25D366] text-base font-bold text-[#04260F]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.6-.3.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z" /></svg>
          {t("waButton")}
        </a>
        <p className="flex items-center justify-center gap-2 text-[13px] text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-[#25D366]" />{t("waWaiting")}</p>
        <p className="text-xs leading-normal text-muted">{t("waHelp")}</p>
        <button type="button" onClick={() => { setSent(null); setError(""); }} className="text-sm font-bold text-[#00209F] dark:text-primary">{t("waRestart")}</button>
      </div>
    );
  }

  if (sent) {
    const tone = sent.status === "APPROVED" ? "ok" : sent.status === "REJECTED" ? "no" : "wait";
    return (
      <div className="flex flex-col items-center gap-3.5 px-2.5 py-10 text-center">
        <span className={`grid h-[72px] w-[72px] place-items-center rounded-full ${tone === "no" ? "bg-[#FEE2E2] text-[#991B1B]" : tone === "ok" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEF3C7] text-[#92400E]"}`}>
          {tone === "no" ? (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
          ) : tone === "ok" ? (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          )}
        </span>
        <p className="text-[22px] font-extrabold">{t(`state_${tone}_title`)}</p>
        <p className="text-sm leading-normal text-text/80">{t(`state_${tone}_body`)}</p>
        <Link href="/account/wallet" className="mt-2 flex h-[52px] items-center rounded-[14px] bg-text px-[22px] text-[15px] font-bold text-surface">{t("doneCta")}</Link>
        {tone !== "no" && <Link href="/account/orders" className="text-sm font-bold text-[#00209F] dark:text-primary">{t("doneOrders")}</Link>}
      </div>
    );
  }

  const label = "text-[13px] font-bold uppercase tracking-[0.6px] text-muted";
  return (
    <form
      className="flex flex-col gap-[18px]"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const [localId, fp] = await Promise.all([getLocalId(), getFingerprint()]);
          const r = await submitTrial({ offer: cur.key, link, phone: whatsapp ? undefined : phone, localId, fp, captcha });
          if (r.ok) setSent({ status: r.status, code: r.code, wa: r.wa });
          else {
            setError(t.has(`error_${r.error}`) ? t(`error_${r.error}`) : t("error_generic"));
            setCaptcha("");
            setCaptchaKey((k) => k + 1);
          }
        });
      }}
    >
      <p className="text-sm leading-normal text-text/80">{t.rich("intro", { b: (c) => <b>{c}</b> })}</p>

      <section className="flex flex-col gap-2.5">
        <h2 className={label}>{t("step1")}</h2>
        {offers.map((o, i) => {
          const p = PLATFORMS[o.platform];
          const on = i === pick;
          return (
            <button key={o.key} type="button" aria-pressed={on} onClick={() => setPick(i)} className={`flex items-center gap-3 rounded-[14px] border-2 bg-surface px-3.5 py-3 text-left ${on ? "border-text" : "border-border"}`}>
              <span className="grid h-10 w-10 flex-none place-items-center rounded-[11px] text-[13px] font-extrabold text-white" style={{ background: p?.color }}>{p?.letter}</span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-bold">{o.label}</span>
                <span className="text-xs text-muted">{t("avg", { time: o.avg })}</span>
              </span>
              <span className="rounded-full bg-[#DCFCE7] px-2.5 py-[5px] text-xs font-extrabold text-[#166534]">{t("free")}</span>
            </button>
          );
        })}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={label}>{t("step2")}</h2>
        <label htmlFor="tlink" className="text-sm font-semibold">{cur.post ? t("linkPost") : t("linkProfile")}</label>
        <input id="tlink" type="url" inputMode="url" required value={link} onChange={(e) => setLink(e.target.value)} placeholder={linkExample(cur.platform, cur.post)}
          className={`h-[50px] rounded-xl bg-surface px-3.5 text-base ${linkBad ? "border-2 border-[#DC2626]" : "border border-[#CBD2E1] dark:border-border"}`} />
      </section>

      {whatsapp ? (
        <section className="flex flex-col gap-2">
          <h2 className={label}>{t("step3")}</h2>
          <p className="rounded-xl bg-surface-2 p-3 text-[13px] leading-normal">{t("waExplain")}</p>
        </section>
      ) : (
      <section className="flex flex-col gap-2">
        <h2 className={label}>{t("step3")}</h2>
        <label htmlFor="phone" className="text-sm font-semibold">{t("phone")}</label>
        <div className="flex gap-2">
          <span className="flex h-[50px] items-center rounded-xl border border-[#CBD2E1] bg-[#F8FAFC] px-3 font-bold text-[#0F172A] dark:border-border dark:bg-surface-2 dark:text-text">+509</span>
          <input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required placeholder="3X XX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="h-[50px] min-w-0 flex-1 rounded-xl border border-[#CBD2E1] bg-surface px-3.5 text-base dark:border-border" />
        </div>
        <p className="text-xs text-muted">{t("phoneHint")}</p>
      </section>
      )}

      <Turnstile key={captchaKey} onToken={setCaptcha} locale={locale} />

      {error && <p role="alert" className="rounded-[10px] bg-[#FEE2E2] px-3 py-2.5 text-[13px] text-[#991B1B]">{error}</p>}
      {signedIn ? (
        <button disabled={pending || !link.trim() || (!whatsapp && !phone.trim()) || linkBad || (turnstileOn && !captcha)} className="h-[54px] rounded-[14px] bg-text text-base font-bold text-surface disabled:bg-[#CBD5E1] disabled:text-[#475569]">{pending ? t("sending") : whatsapp ? t("submitWa") : t("submit")}</button>
      ) : (
        <Link href="/auth/register?next=/trial" className="flex h-[54px] items-center justify-center rounded-[14px] bg-text text-base font-bold text-surface">{t("signIn")}</Link>
      )}
      <p className="text-xs leading-normal text-muted">{t("footer")}</p>
    </form>
  );
}
