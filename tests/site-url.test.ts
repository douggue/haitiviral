import { afterEach, describe, expect, it, vi } from "vitest";
import { onSiteDomain, siteUrl } from "@/lib/site-url";

afterEach(() => vi.unstubAllEnvs());

describe("site address", () => {
  it("live site always uses haitigaming.net, even if the env points to vercel.app", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://haiti-gaming.vercel.app");
    expect(siteUrl()).toBe("https://www.haitigaming.net");
  });
  it("an explicit own domain wins", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com/");
    expect(siteUrl()).toBe("https://shop.example.com");
  });
  it("email links are moved to the site's domain, callback included", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const link = onSiteDomain("https://haiti-gaming.vercel.app/api/auth/verify-email?token=abc&callbackURL=https%3A%2F%2Fhaiti-gaming.vercel.app%2Fht%2Fcheckout");
    expect(link).toBe("https://www.haitigaming.net/api/auth/verify-email?token=abc&callbackURL=https%3A%2F%2Fwww.haitigaming.net%2Fht%2Fcheckout");
    expect(onSiteDomain("https://haiti-gaming.vercel.app/api/auth/verify-email?token=abc&callbackURL=%2Fht%2Fcheckout")).toBe(
      "https://www.haitigaming.net/api/auth/verify-email?token=abc&callbackURL=%2Fht%2Fcheckout",
    );
  });
});
