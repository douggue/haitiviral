/**
 * Free trial anti-cheat, pure parts (tested in tests/trial-risk.test.ts):
 * - the social account behind a link, so one profile gets one trial whatever link form is pasted
 * - throwaway email domains
 * - the risk score: low → sent automatically, middle → staff look, high → refused
 */

/** "tiktok:mika" from a profile or video link; null when the link doesn't show the account (e.g. instagram.com/p/…). */
export function socialHandle(platform: string, url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const parts = u.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p).toLowerCase());
  const at = parts.find((p) => p.startsWith("@"));
  let name: string | null = null;
  if (platform === "tiktok" || platform === "youtube") name = at ? at.slice(1) : null;
  else if (platform === "instagram") name = parts[0] === "stories" ? parts[1] : parts[0] && !["p", "reel", "reels", "tv", "explore"].includes(parts[0]) ? parts[0] : null;
  else if (platform === "facebook") {
    if (parts[0] === "profile.php") name = u.searchParams.get("id");
    else if (parts[0] && !["watch", "share", "reel", "photo", "story.php", "permalink.php", "groups"].includes(parts[0])) name = parts[0];
  } else if (platform === "x" || platform === "telegram") name = parts[0] && parts[0] !== "i" ? parts[0] : null;
  name = name?.replace(/^@/, "").replace(/[^a-z0-9._-]/g, "") ?? null;
  return name && name.length >= 2 ? `${platform}:${name}` : null;
}

/** Common throwaway inbox domains (a short list; staff still see every request). */
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "10minutemail.com", "10minutemail.net", "tempmail.com",
  "temp-mail.org", "temp-mail.io", "tempmail.net", "tempmailo.com", "throwawaymail.com", "yopmail.com", "yopmail.fr", "yopmail.net",
  "getnada.com", "nada.email", "trashmail.com", "trashmail.de", "dispostable.com", "maildrop.cc", "mailnesia.com", "mintemail.com",
  "fakeinbox.com", "emailondeck.com", "mohmal.com", "burnermail.io", "spamgourmet.com", "moakt.com", "tmail.ws", "tmpmail.org",
  "tmpmail.net", "mail.tm", "mail.gw", "inboxkitten.com", "fakemail.net", "emailfake.com", "crazymailing.com", "mytemp.email",
  "tempinbox.com", "discard.email", "mailcatch.com", "spambox.us", "33mail.com", "linshiyouxiang.net", "byom.de", "dropmail.me",
  "1secmail.com", "1secmail.net", "1secmail.org", "minuteinbox.com", "tempr.email", "cs.email", "vomoto.com", "luxusmail.org",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim() ?? "";
  if (!domain) return false;
  return DISPOSABLE.has(domain) || [...DISPOSABLE].some((d) => domain.endsWith(`.${d}`));
}

export type TrialSignals = {
  /** VPN, proxy, Tor or a data center (from the connection check) */
  proxy: boolean | null;
  /** two-letter country of the connection, null if unknown */
  country: string | null;
  accountAgeMinutes: number;
  /** another trial came from a browser with the same model/settings print */
  sameFingerprint: boolean;
  /** another trial came from the same internet connection in the last 30 days */
  sameIp: boolean;
  /** the account shares a browser with other accounts */
  sharedBrowser: boolean;
  /** at least one paid top-up */
  hasDeposit: boolean;
};

export type TrialPolicy = { autoBelow: number; refuseAt: number };

/** Points add up; each reason is shown to staff. */
export function scoreTrial(s: TrialSignals) {
  const reasons: { points: number; why: string }[] = [];
  const add = (points: number, why: string) => reasons.push({ points, why });
  if (s.proxy === true) add(45, "VPN, proxy or data center connection");
  if (s.proxy === null) add(5, "Connection could not be checked");
  if (s.country && s.country !== "HT") add(15, `Connection outside Haiti (${s.country})`);
  if (s.accountAgeMinutes < 60) add(10, "Account created less than 1 hour ago");
  if (s.sameFingerprint) add(30, "Same phone model and settings as another trial");
  if (s.sameIp) add(25, "Same internet connection as another trial (30 days)");
  if (s.sharedBrowser) add(20, "Browser shared with other accounts");
  if (s.hasDeposit) add(-15, "Has already topped up");
  const score = Math.max(0, reasons.reduce((a, r) => a + r.points, 0));
  return { score, reasons };
}

export function trialDecision(score: number, p: TrialPolicy): "approve" | "review" | "refuse" {
  if (score >= p.refuseAt) return "refuse";
  return score < p.autoBelow ? "approve" : "review";
}
