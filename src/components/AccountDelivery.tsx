"use client";
import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CopyButton } from "./CopyButton";
import { parseCredential, parseSmsLine, totp } from "@/lib/accounts";
import { readSmsCode } from "@/actions/sms-code";

type Line = { id: string; text: string };

/** Delivered accounts: each part with its own copy button, a live 2FA code, and the first-steps guide. */
export function AccountDelivery({ kind, lines, warrantyUntil, supportHref }: { kind: "account" | "sms"; lines: Line[]; warrantyUntil: string | null; supportHref: string }) {
  const t = useTranslations("acctUi");
  const tc = useTranslations("order");
  const locale = useLocale();
  const inWarranty = warrantyUntil && new Date(warrantyUntil).getTime() > Date.now();
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-4">
      <p className="text-sm font-semibold">{t(kind === "sms" ? "yourNumbers" : "yourAccounts")}</p>
      {lines.map((l, i) => (kind === "sms" ? <SmsLine key={l.id} line={l} /> : <AccountLine key={l.id} n={i + 1} text={l.text} copy={tc("copy")} copied={tc("copied")} />))}
      {kind === "account" && (
        <details className="rounded-lg bg-surface p-3 text-[13px] leading-normal">
          <summary className="cursor-pointer font-bold">{t("guideTitle")}</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {[1, 2, 3, 4, 5].map((n) => <li key={n}>{t(`guide${n}`)}</li>)}
          </ol>
        </details>
      )}
      {inWarranty ? (
        <p className="text-xs text-muted">{t("warrantyUntil", { date: new Date(warrantyUntil!).toLocaleString(locale === "fr" ? "fr-FR" : "fr-HT", { dateStyle: "medium", timeStyle: "short" }) })} <a href={supportHref} className="font-bold text-primary underline">{t("claim")}</a></p>
      ) : warrantyUntil ? <p className="text-xs text-muted">{t("warrantyOver")}</p> : null}
    </div>
  );
}

const LABELS = { login: "partLogin", password: "partPassword", recovery: "partRecovery", twofa: "partTwofa", cookie: "partCookie", other: "partOther" } as const;

function AccountLine({ n, text, copy, copied }: { n: number; text: string; copy: string; copied: string }) {
  const t = useTranslations("acctUi");
  const parts = parseCredential(text);
  const secret = parts.find((p) => p.label === "twofa")?.value;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.5px] text-muted">{t("accountN", { n })}</span>
        <CopyButton value={text} label={t("copyAll")} done={copied} icon={false} className="btn-ghost min-h-8 shrink-0 px-2 text-xs" />
      </div>
      {parts.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3 border-t border-border pt-1.5">
          <span className="min-w-0">
            <span className="block text-[11px] text-muted">{t(LABELS[p.label])}</span>
            <code className="block break-all font-mono text-sm font-semibold">{p.label === "cookie" ? `${p.value.slice(0, 40)}…` : p.value}</code>
          </span>
          <CopyButton value={p.value} label={copy} done={copied} />
        </div>
      ))}
      {secret && <TwoFa secret={secret} />}
    </div>
  );
}

/** 6-digit code from the account's 2FA key, made in the browser (like Google Authenticator). */
export function TwoFa({ secret }: { secret: string }) {
  const t = useTranslations("acctUi");
  const tc = useTranslations("order");
  const [code, setCode] = useState<string | null>(null);
  const [left, setLeft] = useState(30);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const c = await totp(secret);
      if (alive) {
        setCode(c);
        setLeft(30 - (Math.floor(Date.now() / 1000) % 30));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [secret]);
  if (!code) return null;
  return (
    <div className="mt-1 flex items-center justify-between gap-3 rounded-lg bg-[#EEF1FF] p-2.5 dark:bg-surface-2">
      <span>
        <span className="block text-[11px] font-semibold text-[#3730A3] dark:text-muted">{t("twofaNow", { s: left })}</span>
        <span className="font-mono text-xl font-extrabold tracking-[3px]">{code.slice(0, 3)} {code.slice(3)}</span>
      </span>
      <CopyButton value={code} label={tc("copy")} done={tc("copied")} />
    </div>
  );
}

function SmsLine({ line }: { line: Line }) {
  const t = useTranslations("acctUi");
  const tc = useTranslations("order");
  const { number } = parseSmsLine(line.text);
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "none" | "error">("idle");
  const [fallback, setFallback] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const read = () =>
    start(async () => {
      const r = await readSmsCode(line.id);
      if (!r.ok) return setState("error");
      setCode(r.code);
      setFallback(r.fallback);
      setState(r.code ? "idle" : "none");
    });
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[11px] text-muted">{t("number")}</span>
          <code className="block break-all font-mono text-base font-bold">{number ?? line.text}</code>
        </span>
        <CopyButton value={number ?? line.text} label={tc("copy")} done={tc("copied")} />
      </div>
      {code && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-[#DCFCE7] p-2.5 text-[#14532D]">
          <span><span className="block text-[11px] font-semibold">{t("lastCode")}</span><span className="font-mono text-xl font-extrabold tracking-[3px]">{code}</span></span>
          <CopyButton value={code} label={tc("copy")} done={tc("copied")} />
        </div>
      )}
      {state === "none" && <p className="text-xs text-muted">{t("noCodeYet")}{fallback && <> <a href={fallback} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline">{t("openPage")}</a></>}</p>}
      {state === "error" && <p className="text-xs text-danger">{t("error_generic")}</p>}
      <button type="button" onClick={read} disabled={pending} className="min-h-11 rounded-xl bg-text text-sm font-bold text-surface disabled:opacity-60">{pending ? t("sending") : t("getCode")}</button>
    </div>
  );
}
