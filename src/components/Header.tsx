import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/permissions";
import { getDisplaySettings } from "@/lib/settings";
import { t as txt } from "@/lib/text";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { PriorityNav } from "./NavMore";
import { BellIcon, SearchIcon, UserIcon } from "./Icons";
import { CartButton, CurrencySwitch, LocaleSwitch, MobileMenu, ThemeToggle } from "./HeaderClient";

export async function Header() {
  const t = await getTranslations("common");
  const locale = await getLocale();
  const [user, settings] = await Promise.all([getUser(), getDisplaySettings()]);
  const unread = user ? await prisma.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  const custom = settings.navigation?.header ?? [];
  const nav = custom.length ? custom.map((l) => ({ href: l.href, label: txt(l.label, locale) })) : [
    { href: "/store", label: t("store") },
    { href: "/categories", label: t("categories") },
    { href: "/guides", label: t("guides") },
    { href: "/news", label: t("news") },
    { href: "/faq", label: t("faqShort") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-2 sm:gap-3">
        <Link href="/" className="shrink-0">
          <Logo src={settings.logoUrl} darkSrc={settings.logoDarkUrl} alt={settings.businessName} />
        </Link>
        {/* As many links as fit; the rest go under "More" instead of being cut off */}
        <PriorityNav items={nav} moreLabel={t("more")} />
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 md:ml-0">
          <div className="hidden items-center gap-1.5 md:flex">
            <LocaleSwitch />
            <CurrencySwitch />
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-1.5 md:hidden">
            <LocaleSwitch />
            <CurrencySwitch compact />
          </div>
          <Link href="/store" className="btn-ghost hidden min-h-10 px-2.5 md:inline-flex" aria-label={t("search")}>
            <SearchIcon />
          </Link>
          {user && (
            <Link href="/account/notifications" className="btn-ghost relative min-h-10 px-2 sm:px-2.5" aria-label={`${t("notifications")} (${unread})`}>
              <BellIcon />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-surface" />}
            </Link>
          )}
          {/* Phones: search and cart live in the bottom bar, leaving room for the currency toggle */}
          <div className="hidden md:block">
            <CartButton />
          </div>
          {user ? (
            <Link href="/account" className="btn-ghost hidden min-h-10 px-2.5 md:inline-flex" aria-label={t("account")}>
              <Avatar name={user.name} image={user.image} size={32} />
            </Link>
          ) : (
            <Link href="/auth/login" className="btn-primary glow-btn hidden min-h-10 md:inline-flex">
              <UserIcon width={18} height={18} />
              {t("signIn")}
            </Link>
          )}
          {user && isStaff(user.role) && (
            <a href="/admin" className="btn-secondary hidden min-h-10 lg:inline-flex">{t("admin")}</a>
          )}
          <MobileMenu nav={nav} signedIn={!!user} name={user?.name} image={user?.image} />
        </div>
      </div>
    </header>
  );
}
