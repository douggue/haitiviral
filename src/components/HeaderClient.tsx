"use client";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Flag } from "./Flags";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useRouter as useNextRouter } from "next/navigation";
import { Link, getPathname, usePathname, useRouter } from "@/i18n/navigation";
import { localeNames, locales, type Locale } from "@/i18n/routing";
import { setCurrency, saveLocalePreference } from "@/actions/prefs";
import { authClient } from "@/lib/auth-client";
import { useStore } from "./cart/CartProvider";
import { BagIcon, BookIcon, CartIcon, CloseIcon, FileIcon, HelpIcon, HomeIcon, LoginIcon, LogoutIcon, MenuIcon, MoonIcon, NewsIcon, StoreIcon, SunIcon, TagIcon, UserIcon, UserPlusIcon, WalletIcon } from "./Icons";
import { Avatar } from "./Avatar";

/**
 * Keeps light/dark after client-side navigation. Changing language re-renders <html> from the server,
 * which drops the "dark" class the first-paint script had added; this puts it back before the browser paints.
 */
export function ThemeKeeper({ defaultMode }: { defaultMode: "dark" | "light" }) {
  const locale = useLocale();
  const pathname = usePathname();
  useLayoutEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("hg_theme");
    } catch {}
    const dark = saved ? saved === "dark" : defaultMode === "dark";
    const html = document.documentElement;
    html.classList.toggle("dark", dark);
    // After a language switch: same scroll position, no entrance animations replaying, a short fade in.
    if (html.dataset.switching) {
      delete html.dataset.switching;
      html.dataset.switched = "1";
      try {
        const y = Number(sessionStorage.getItem("hg_scroll"));
        sessionStorage.removeItem("hg_scroll");
        if (y > 0) window.scrollTo(0, y);
      } catch {}
      const id = setTimeout(() => delete html.dataset.switched, 700);
      return () => clearTimeout(id);
    }
  }, [locale, pathname, defaultMode]);
  return null;
}

export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const t = useTranslations("common");
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("hg_theme", next ? "dark" : "light");
      // Also a cookie, so the server sends the page already in the right theme (no flash on any navigation).
      document.cookie = `hg_theme=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
    } catch {}
  }
  return (
    <button type="button" onClick={toggle} className="btn-ghost min-h-10 px-2.5" aria-label={`${t("theme")}: ${dark ? t("dark") : t("light")}`}>
      {dark ? <SunIcon /> : <MoonIcon />}
      {withLabel && <span>{dark ? t("light") : t("dark")}</span>}
    </button>
  );
}

/** HTG | USD toggle: prices everywhere switch at once; the choice is remembered (cookie and profile). */
export function CurrencySwitch({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("common");
  const { currency } = useStore();
  const [shown, setShown] = useState(currency);
  const [pending, start] = useTransition();
  useEffect(() => setShown(currency), [currency]);
  const pick = (c: "HTG" | "USD") => {
    if (c === shown || pending) return;
    setShown(c); // highlight at once; prices update when the page refreshes
    start(() => setCurrency(c));
  };
  return (
    <div role="radiogroup" aria-label={t("currency")} className={`inline-flex shrink-0 rounded-full border border-border bg-surface-2 p-0.5 ${pending ? "opacity-70" : ""}`}>
      {(["HTG", "USD"] as const).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={shown === c}
          onClick={() => pick(c)}
          className={`rounded-full font-bold transition-colors ${compact ? "min-h-8 px-2 text-[11px]" : "min-h-9 px-3 text-xs"} ${shown === c ? "bg-primary text-white shadow-sm" : "text-muted hover:text-text"}`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

/** Switch language and stay on the same page; signed-in customers keep the choice on their account. */
function useChangeLocale() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const nextRouter = useNextRouter();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<Locale>(locale);
  useEffect(() => setPicked(locale), [locale]);

  /**
   * Fetch the other languages of this page ahead of time, so switching is near-instant.
   * Through Next's own router: next-intl's router.prefetch would also save each prefetched language
   * as the visitor's choice (the last one, Español, would win).
   */
  const prefetch = () => {
    for (const l of locales) {
      // @ts-expect-error -- params are compatible with the current pathname
      if (l !== locale) nextRouter.prefetch(getPathname({ href: { pathname, params }, locale: l, forcePrefix: true }));
    }
  };

  const change = (next: Locale) => {
    if (next === locale) return;
    setPicked(next); // the chosen flag lights up at once
    // A thin progress bar and a soft fade while the new language loads (see globals.css: data-switching).
    document.documentElement.dataset.switching = "1";
    setTimeout(() => delete document.documentElement.dataset.switching, 8000); // never stay dimmed if the network fails
    try {
      sessionStorage.setItem("hg_scroll", String(window.scrollY));
    } catch {}
    start(() => {
      saveLocalePreference(next);
      // @ts-expect-error -- params are compatible with the current pathname
      router.replace({ pathname, params }, { locale: next, scroll: false });
    });
  };
  return { locale: picked, change, pending, prefetch };
}

/** Header: the current flag; tapping it opens the four languages. */
export function LocaleSwitch() {
  const t = useTranslations("common");
  const { locale, change, pending, prefetch } = useChangeLocale();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => {
          if (!open) prefetch();
          setOpen((o) => !o);
        }}
        onPointerEnter={prefetch}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t("language")}: ${localeNames[locale]}`}
        className={`grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-2 transition-transform hover:scale-105 ${pending ? "opacity-60" : ""}`}
      >
        <Flag locale={locale} size={24} />
      </button>
      {open && (
        <ul role="listbox" aria-label={t("language")} className="animate-rise absolute right-0 top-11 z-50 w-44 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-2xl">
          {locales.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={l === locale}
                onClick={() => {
                  setOpen(false);
                  change(l);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${l === locale ? "bg-primary-soft text-primary" : "hover:bg-surface-2"}`}
              >
                <Flag locale={l} size={22} />
                {localeNames[l]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Row of four flags (menu, sign-in and sign-up pages): one tap changes the language. */
export function LanguageFlags({ className = "" }: { className?: string }) {
  const t = useTranslations("common");
  const { locale, change, pending, prefetch } = useChangeLocale();
  useEffect(() => {
    const id = setTimeout(prefetch, 800); // after the page has settled
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div role="radiogroup" aria-label={t("language")} className={`flex items-center gap-2 ${pending ? "opacity-60" : ""} ${className}`}>
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={l === locale}
          aria-label={localeNames[l]}
          title={localeNames[l]}
          onClick={() => change(l)}
          className={`grid h-10 w-10 place-items-center rounded-full border-2 transition-transform hover:scale-110 ${l === locale ? "border-primary bg-primary-soft shadow-[0_0_14px_var(--glow)]" : "border-transparent opacity-70 hover:opacity-100"}`}
        >
          <Flag locale={l} size={26} />
        </button>
      ))}
    </div>
  );
}

/**
 * Cart count. It "pops" only when the count goes up while the page is open (something was just added),
 * not when a page loads, the language changes or the saved cart arrives.
 */
function CountBadge({ count, className }: { count: number; className: string }) {
  const seen = useRef<number | null>(null);
  const mountedAt = useRef(0);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);
  useEffect(() => {
    const before = seen.current;
    seen.current = count;
    // First value after loading: just show it. The account cart merging in a moment later is not an "add" either.
    if (before === null || performance.now() - mountedAt.current < 2500) return;
    if (count > before) setBump((b) => b + 1);
  }, [count]);
  return (
    <span key={bump} className={`${bump ? "pop " : ""}${className}`}>
      {count}
    </span>
  );
}

export function CartButton() {
  const t = useTranslations("common");
  const { count, ready } = useStore();
  return (
    <Link href="/cart" className="btn-ghost relative min-h-10 px-2.5" aria-label={`${t("cart")} (${count})`}>
      <CartIcon />
      {ready && count > 0 && (
        <CountBadge count={count} className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-white shadow-[0_0_10px_var(--glow)]" />
      )}
    </Link>
  );
}

export function SignOutButton({ className = "btn-secondary" }: { className?: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      <LogoutIcon width={18} height={18} aria-hidden />
      {t("signOut")}
    </button>
  );
}

type NavItem = { href: string; label: string };

/** Icon for a menu link, chosen from its address (custom menu links get a page icon). */
function navIcon(href: string) {
  if (href === "/" || href === "") return HomeIcon;
  if (href.startsWith("/store")) return StoreIcon;
  if (href.startsWith("/categor")) return TagIcon;
  if (href.startsWith("/guide")) return BookIcon;
  if (href.startsWith("/news")) return NewsIcon;
  if (href.startsWith("/faq") || href.startsWith("/help") || href.startsWith("/support")) return HelpIcon;
  if (href.startsWith("/account/wallet")) return WalletIcon;
  if (href.startsWith("/account/orders")) return BagIcon;
  if (href.startsWith("/account")) return UserIcon;
  return FileIcon;
}

function MenuLink({ href, label }: { href: string; label: string }) {
  const Icon = navIcon(href);
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl px-2 py-2 font-semibold hover:bg-surface-2">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary transition-transform group-hover:scale-105">
        <Icon width={20} height={20} />
      </span>
      <span className="flex-1">{label}</span>
      <span className="text-muted transition-transform group-hover:translate-x-0.5" aria-hidden>›</span>
    </Link>
  );
}

export function MobileMenu({ nav, signedIn, name, image }: { nav: NavItem[]; signedIn: boolean; name?: string; image?: string | null }) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="btn-ghost min-h-10 px-2 sm:px-2.5 md:hidden" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}>
        <MenuIcon />
        <span className="sr-only">{t("menu")}</span>
      </button>
      {/* Rendered into <body>: the header's backdrop blur would otherwise trap this fixed panel inside the 64px header. */}
      {open && mounted && createPortal(
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" id="mobile-menu">
          <button type="button" aria-label={t("close")} className="absolute inset-0 bg-midnight/60" onClick={() => setOpen(false)} />
          <div className="animate-rise absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col gap-1 overflow-y-auto bg-surface p-4 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex min-w-0 items-center gap-2.5 font-semibold">
                {name && <Avatar name={name} image={image} size={36} />}
                <span className="truncate">{name ?? t("menu")}</span>
              </span>
              <button type="button" className="btn-ghost min-h-10 px-2.5" onClick={() => setOpen(false)}>
                <CloseIcon />
                <span className="sr-only">{t("close")}</span>
              </button>
            </div>
            {nav.map((n) => <MenuLink key={n.href} href={n.href} label={n.label} />)}
            <div className="my-3 border-t border-border" />
            {signedIn ? (
              <>
                <MenuLink href="/account" label={t("account")} />
                <MenuLink href="/account/wallet" label={t("wallet")} />
                <MenuLink href="/account/orders" label={t("orders")} />
                <SignOutButton className="btn-secondary mt-2" />
              </>
            ) : (
              <div className="grid gap-2">
                <Link href="/auth/login" className="btn-secondary"><LoginIcon width={18} height={18} aria-hidden />{t("signIn")}</Link>
                <Link href="/auth/register" className="btn-primary"><UserPlusIcon width={18} height={18} aria-hidden />{t("signUp")}</Link>
              </div>
            )}
            <div className="mt-auto space-y-3 rounded-2xl border border-border bg-surface-2/60 p-3">
              <LanguageFlags className="justify-between" />
              <div className="flex items-center justify-between gap-2">
                <CurrencySwitch />
                <ThemeToggle withLabel />
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * On phones, iOS Safari keeps fixed bars where they were when the keyboard opens, so they float
 * in the middle of the screen. While the keyboard is up (a field is focused and the visible area shrank),
 * <html data-kb> is set and anything with the class "kb-hide" (bottom bar, WhatsApp button) steps aside.
 */
function useKeyboardFlag() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !window.matchMedia("(pointer: coarse)").matches) return;
    const root = document.documentElement;
    const typing = (el: Element | null) =>
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLElement && el.isContentEditable) ||
      (el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "image", "hidden"].includes(el.type));
    // Tallest visible area seen so far = no keyboard. Reset on rotation.
    let full = vv.height;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      full = Math.max(full, vv.height);
      // Hidden only while a field is focused AND the visible area really shrank (keyboard up). Anything else: shown.
      if (typing(document.activeElement) && vv.height < full * 0.8) root.dataset.kb = "";
      else delete root.dataset.kb;
    };
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(check, 100);
    };
    const rotate = () => {
      full = 0;
      later();
    };
    vv.addEventListener("resize", later);
    document.addEventListener("focusin", later);
    document.addEventListener("focusout", later);
    window.addEventListener("orientationchange", rotate);
    return () => {
      clearTimeout(timer);
      vv.removeEventListener("resize", later);
      document.removeEventListener("focusin", later);
      document.removeEventListener("focusout", later);
      window.removeEventListener("orientationchange", rotate);
      delete root.dataset.kb;
    };
  }, []);
}

/** Phone-only bottom navigation: the five places customers go most. */
export function BottomNav({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("common");
  const pathname = usePathname();
  const { count, ready } = useStore();
  useKeyboardFlag();
  const items = [
    { href: "/", label: t("home"), icon: HomeIcon, active: pathname === "/" },
    { href: "/store", label: t("store"), icon: StoreIcon, active: pathname.startsWith("/store") || pathname.startsWith("/categories") || pathname.startsWith("/products") },
    { href: "/cart", label: t("cart"), icon: CartIcon, active: pathname.startsWith("/cart") || pathname.startsWith("/checkout"), badge: ready ? count : 0 },
    { href: signedIn ? "/account/wallet" : "/auth/login?next=/account/wallet", label: t("wallet"), icon: WalletIcon, active: pathname.startsWith("/account/wallet") },
    { href: signedIn ? "/account" : "/auth/login", label: t("tabAccount"), icon: UserIcon, active: (pathname.startsWith("/account") && !pathname.startsWith("/account/wallet")) || pathname.startsWith("/auth") },
  ];
  return (
    <nav
      aria-label={t("menu")}
      className="kb-hide fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", paddingLeft: "env(safe-area-inset-left, 0px)", paddingRight: "env(safe-area-inset-right, 0px)" }}
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map(({ href, label, icon: Icon, active, badge }) => (
          <li key={label} className="min-w-0">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${active ? "text-primary" : "text-muted hover:text-text"}`}
            >
              <span className={`relative grid h-7 w-12 place-items-center rounded-full transition-colors ${active ? "bg-primary-soft" : ""}`}>
                <Icon width={20} height={20} />
                {!!badge && (
                  <CountBadge count={badge} className="absolute -right-0.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white" />
                )}
              </span>
              <span className="max-w-full truncate px-1">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
