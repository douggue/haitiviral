"use client";
import { LoginIcon, UserPlusIcon } from "./Icons";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname as useRawPathname, useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Turnstile, turnstileOn } from "./Turnstile";
import { PhoneInput } from "./PhoneInput";
import { normalizePhone } from "@/lib/phone";

export function AuthForm({ mode: firstMode, google = false }: { mode: "login" | "register"; google?: boolean }) {
  const t = useTranslations("auth");
  const tg = useTranslations("google");
  // Sign in ↔ create account switch in place (no page load): the address changes with history.pushState,
  // and the mode follows the address so the Back button works too.
  const rawPath = useRawPathname();
  const mode = rawPath?.endsWith("/auth/register") ? "register" : rawPath?.endsWith("/auth/login") ? "login" : firstMode;
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next");
  const [error, setError] = useState(sp.get("blocked") ? t("blocked") : sp.get("error") ? tg("error") : "");
  const [loading, setLoading] = useState(false);
  // Until JavaScript is ready the button stays disabled, so credentials are never sent by a native form submit.
  const [hydrated, setHydrated] = useState(false);
  const [totp, setTotp] = useState(false);
  const [useBackup, setUseBackup] = useState(false);
  const t2 = useTranslations("auth2");
  const tu = useTranslations("authUi");
  const [showPw, setShowPw] = useState(false);
  const [pw, setPw] = useState("");
  // Rough guide only; the server also rejects passwords found in data breaches.
  const score = !pw ? 0 : Math.min(4, (pw.length >= 8 ? 1 : 0) + (pw.length >= 12 ? 1 : 0) + (/[A-Z]/.test(pw) && /[a-z]/.test(pw) ? 1 : 0) + (/[\d\W]/.test(pw) ? 1 : 0));
  const scoreLabel = [tu("weak"), tu("weak"), tu("fair"), tu("good"), tu("strong")][score];
  useEffect(() => setHydrated(true), []);
  const [captcha, setCaptcha] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);

  const nextQs = next ? `?next=${encodeURIComponent(next)}` : "";
  function switchTo(e: React.MouseEvent, to: "login" | "register") {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (to === mode) return;
    setError("");
    window.history.pushState(null, "", `/${locale}/auth/${to}${nextQs}`);
    const [from, into] = to === "register" ? [t("loginTitle"), t("registerTitle")] : [t("registerTitle"), t("loginTitle")];
    document.title = document.title.replace(from, into);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim().toLowerCase();
    const password = String(f.get("password"));
    const fetchOptions = { headers: { "x-turnstile-token": captcha } };
    const res =
      mode === "login"
        ? await authClient.signIn.email({ email, password, fetchOptions })
        : await authClient.signUp.email({
            email,
            password,
            name: String(f.get("name")).trim(),
            phone: normalizePhone(String(f.get("phone") ?? "")) ?? (String(f.get("phone") ?? "").trim() || undefined),
            locale,
            fetchOptions,
          } as Parameters<typeof authClient.signUp.email>[0]);
    setLoading(false);
    if (res.error) {
      const { status, code } = res.error as { status: number; code?: string };
      // Turnstile tokens work once: get a fresh one for the next try.
      setCaptcha("");
      setCaptchaKey((k) => k + 1);
      if (code === "CAPTCHA_FAILED") setError(t("captcha"));
      else if (status === 429) setError(t("tooMany"));
      else if (code === "ACCOUNT_BLOCKED" || status === 403) setError(t("blocked"));
      else if (code === "PASSWORD_COMPROMISED") setError(t("compromised"));
      // Same message whether or not the email is registered, so the form can't be used to look up accounts.
      else if (mode === "register") setError(t("signupFailed"));
      else setError(t("invalid"));
      return;
    }
    if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      setTotp(true);
      return;
    }
    goNext();
  }

  function goNext() {
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
    router.push(safeNext.replace(/^\/(ht|fr|en|es)(?=\/|$)/, "") || "/account");
    router.refresh();
  }

  async function onTotp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const code = String(new FormData(e.currentTarget).get("code")).replace(/\s/g, "");
    const r = useBackup ? await authClient.twoFactor.verifyBackupCode({ code }) : await authClient.twoFactor.verifyTotp({ code });
    setLoading(false);
    if (r.error) return setError(r.error.status === 429 ? t("tooMany") : t("invalid"));
    goNext();
  }

  if (totp) {
    return (
      <form method="post" onSubmit={onTotp} className="card mx-auto w-full max-w-md space-y-4 p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{t2("totpTitle")}</h1>
        <p className="text-sm text-muted">{useBackup ? t2("backupIntro") : t2("totpIntro")}</p>
        <input key={useBackup ? "b" : "t"} name="code" required autoFocus autoComplete="one-time-code" inputMode={useBackup ? "text" : "numeric"} aria-label={t2("totpTitle")} className="input text-center text-xl tracking-[0.3em]" />
        {error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? tc("loading") : t2("verify")}</button>
        <button type="button" className="w-full text-center text-sm font-semibold text-primary" onClick={() => { setUseBackup(!useBackup); setError(""); }}>{useBackup ? t2("useApp") : t2("useBackup")}</button>
      </form>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit} className="card glow-card mx-auto w-full max-w-md space-y-4 p-6 sm:p-8">
      <nav className="grid grid-cols-2 rounded-2xl bg-surface-2 p-1" aria-label={t("loginTitle")}>
        <Link href={`/auth/login${nextQs}`} onClick={(e) => switchTo(e, "login")} aria-current={mode === "login" ? "page" : undefined} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors duration-200 ${mode === "login" ? "bg-surface text-text shadow-sm" : "text-muted"}`}><LoginIcon width={17} height={17} aria-hidden />{tc("signIn")}</Link>
        <Link href={`/auth/register${nextQs}`} onClick={(e) => switchTo(e, "register")} aria-current={mode === "register" ? "page" : undefined} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors duration-200 ${mode === "register" ? "bg-surface text-text shadow-sm" : "text-muted"}`}><UserPlusIcon width={17} height={17} aria-hidden />{tc("signUp")}</Link>
      </nav>
      <div>
        <h1 className="display text-3xl font-bold">{mode === "login" ? tu("welcomeBack") : t("registerTitle")}</h1>
        <p className="mt-1 text-muted">{mode === "login" ? tu("loginSub") : tu("registerSub")}</p>
      </div>
      {google && (
        <>
          <button
            type="button"
            disabled={!hydrated || loading}
            onClick={async () => {
              setError("");
              setLoading(true);
              const done = `/${locale}${next && next.startsWith("/") && !next.startsWith("//") ? next.replace(/^\/(ht|fr|en|es)(?=\/|$)/, "") || "/account" : "/account"}`;
              const r = await authClient.signIn.social({ provider: "google", callbackURL: done, errorCallbackURL: `/${locale}/auth/login?error=google` });
              if (r?.error) {
                setLoading(false);
                setError(tg("error"));
              }
            }}
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 text-sm font-bold text-[#1f1f1f] shadow-sm transition hover:bg-[#f7f8fa] disabled:opacity-60"
          >
            <GoogleLogo />
            {tg("continue")}
          </button>
          <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            {tg("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      {mode === "register" && (
        <div className="animate-rise">
          <label htmlFor="name" className="label">{t("name")}</label>
          <input id="name" name="name" required maxLength={80} autoComplete="name" className="input" />
        </div>
      )}
      <div>
        <label htmlFor="email" className="label">{t("email")}</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      {mode === "register" && (
        <div className="animate-rise">
          <label htmlFor="phone" className="label">{t("phone")}</label>
          <PhoneInput id="phone" name="phone" />
        </div>
      )}
      <div>
        <label htmlFor="password" className="label">{t("password")}</label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPw ? "text" : "password"}
            required
            minLength={8}
            maxLength={128}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="input pr-20"
            onChange={(e) => setPw(e.target.value)}
          />
          <button type="button" onClick={() => setShowPw(!showPw)} aria-pressed={showPw} className="absolute right-1 top-1/2 min-h-10 -translate-y-1/2 rounded-lg px-3 text-xs font-bold text-muted hover:text-text">
            {showPw ? tu("hide") : tu("show")}
          </button>
        </div>
        {mode === "register" && (
          <>
            <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden>
              {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 rounded-full ${score >= i ? (score <= 1 ? "bg-danger" : score === 2 ? "bg-warning" : "bg-success") : "bg-border"}`} />)}
            </div>
            <p className="mt-1 text-xs text-muted" aria-live="polite">{pw && <b className={score <= 1 ? "text-danger" : score === 2 ? "text-warning" : "text-success"}>{scoreLabel}. </b>}{t("passwordHint")}</p>
          </>
        )}
        {mode === "login" && (
          <Link href="/auth/forgot" className="mt-2 inline-block text-sm font-semibold text-primary">{t("forgot")}</Link>
        )}
      </div>
      <Turnstile key={captchaKey} onToken={setCaptcha} locale={locale} />
      {error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{error}</p>}
      <button className="btn-primary glow-btn min-h-12 w-full text-base" disabled={loading || !hydrated || (turnstileOn && !captcha)}>
        {loading ? (
          tc("loading")
        ) : (
          <>
            {mode === "login" ? <LoginIcon width={20} height={20} aria-hidden /> : <UserPlusIcon width={20} height={20} aria-hidden />}
            {mode === "login" ? tc("signIn") : tc("signUp")}
          </>
        )}
      </button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? t("noAccount") : t("haveAccount")}{" "}
        <Link href={`${mode === "login" ? "/auth/register" : "/auth/login"}${nextQs}`} onClick={(e) => switchTo(e, mode === "login" ? "register" : "login")} className="font-semibold text-primary">
          {mode === "login" ? tc("signUp") : tc("signIn")}
        </Link>
      </p>
    </form>
  );
}

/** Google's official "G" mark (multicolor), as Google's sign-in branding asks. */
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
