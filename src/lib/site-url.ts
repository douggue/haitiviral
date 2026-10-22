/** The shop's own domain. haitigaming.net already redirects here. */
export const CANONICAL_SITE = "https://www.haitigaming.net";

/**
 * Public address of the site, without a trailing slash. Used for links in emails, SEO and payment returns.
 * - NEXT_PUBLIC_SITE_URL when set to your own domain;
 * - on the live site (Vercel production): www.haitigaming.net, never the .vercel.app address;
 * - otherwise the Vercel address, then localhost for development.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit && !explicit.includes(".vercel.app")) return explicit;
  if (process.env.VERCEL_ENV === "production") return CANONICAL_SITE;
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/** Same link, on the site's own domain (emails must never point to the .vercel.app address). */
export function onSiteDomain(url: string): string {
  try {
    const u = new URL(url);
    const site = new URL(siteUrl());
    u.protocol = site.protocol;
    u.host = site.host;
    for (const key of ["callbackURL", "redirectTo"]) {
      const v = u.searchParams.get(key);
      if (v && /^https?:\/\//.test(v)) {
        const inner = new URL(v);
        inner.protocol = site.protocol;
        inner.host = site.host;
        u.searchParams.set(key, inner.toString());
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}
