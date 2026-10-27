/**
 * Accounts and SMS numbers sold through an accounts provider (YTSeller). Shared by the server and the browser.
 * A choice's `account` JSON (ProductVariant.account) says what it is; priceHtg is the price of ONE piece.
 */

export type AccountMeta = {
  kind: "account" | "sms";
  min: number;
  max: number;
  /** "instant": delivered in minutes from stock · "24h": the provider makes it on order */
  delivery: "instant" | "24h";
  /** What the customer must give (the provider's "require"), as a label per language; null = nothing */
  require: Record<string, string> | null;
  /** Replacement window after delivery, in hours (0 = no warranty) */
  warrantyHours: number;
  about: Record<string, string>;
};

const BRANDS: [RegExp, string, string][] = [
  [/gmail|google/, "G", "#EA4335"], [/insta/, "IG", "#C13584"], [/facebook|fb/, "f", "#1877F2"], [/tiktok/, "TT", "#000000"],
  [/discord/, "D", "#5865F2"], [/telegram/, "TG", "#229ED9"], [/youtube/, "YT", "#FF0000"], [/twitter|^x$|-x-/, "X", "#000000"],
  [/apple|icloud/, "", "#111827"], [/reddit/, "R", "#FF4500"], [/whatsapp/, "W", "#25D366"], [/sms|number|phone/, "SMS", "#16A34A"],
];

/** Small badge for a product: letters and colour from its provider category tag ("acct:gmail"). */
export function accountBadge(tags: string[], kind: "account" | "sms") {
  const key = (tags.find((t) => t.startsWith("acct:"))?.slice(5) ?? "").toLowerCase();
  const hit = BRANDS.find(([re]) => re.test(key));
  if (hit) return { letters: hit[1] || key.slice(0, 1).toUpperCase(), color: hit[2] };
  return kind === "sms" ? { letters: "SMS", color: "#16A34A" } : { letters: key.slice(0, 2).toUpperCase() || "#", color: "#00209F" };
}

export function parseAccountMeta(v: unknown): AccountMeta | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Partial<AccountMeta>;
  if (m.kind !== "account" && m.kind !== "sms") return null;
  return {
    kind: m.kind,
    min: Math.max(1, Number(m.min) || 1),
    max: Math.max(1, Number(m.max) || 1),
    delivery: m.delivery === "24h" ? "24h" : "instant",
    require: m.require && typeof m.require === "object" ? m.require : null,
    warrantyHours: Math.max(0, Number(m.warrantyHours) || 0),
    about: m.about ?? {},
  };
}

/** Our price for one piece: provider cost × rate, plus the margin, rounded up to 5 HTG (centimes). */
export function accountPrice(costUsd: number, htgPerUsd: number, marginPct: number) {
  const htg = costUsd * htgPerUsd * (1 + marginPct / 100);
  return Math.max(500, Math.ceil(htg / 5) * 500);
}

export type Credential = { label: "login" | "password" | "recovery" | "twofa" | "cookie" | "other"; value: string }[];

const B32 = /^[A-Z2-7]{16,64}=*$/;

/**
 * One delivered line, e.g. "mail@gmail.com:Pass123:recovery@mail.com:JBSWY3DPEHPK3PXP" or "user|pass|2fa".
 * Split on | or : (not inside a web address), then guess each part. Unknown shapes come back as one "other" part.
 */
export function parseCredential(line: string): Credential {
  const text = line.trim();
  if (!text) return [];
  const sep = text.includes("|") ? "|" : /https?:\/\//i.test(text) ? null : ":";
  if (!sep) return [{ label: "other", value: text }];
  const parts = text.split(sep).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [{ label: "other", value: text }];
  return parts.map((p, i) => {
    if (i === 0) return { label: "login", value: p };
    if (i === 1) return { label: "password", value: p };
    const compact = p.replace(/\s/g, "").toUpperCase();
    if (B32.test(compact)) return { label: "twofa", value: compact };
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(p)) return { label: "recovery", value: p };
    if (p.length > 120) return { label: "cookie", value: p };
    return { label: "other", value: p };
  });
}

/** SMS number line: the phone number and, if the provider gave one, the page where the codes appear. */
export function parseSmsLine(line: string): { number: string | null; url: string | null } {
  const url = /https?:\/\/[^\s|]+/i.exec(line)?.[0] ?? null;
  const rest = url ? line.replace(url, " ") : line;
  const number = /\+?\d[\d\s().-]{7,}\d/.exec(rest)?.[0]?.replace(/[^\d+]/g, "") ?? null;
  return { number, url };
}

/** A 4–8 digit verification code in a text (an SMS or a page), or null. */
export function findSmsCode(text: string): string | null {
  const plain = text.replace(/<[^>]+>/g, " ");
  return /(?:code|kòd|kod|verification|G-)[^\d]{0,20}(\d{4,8})\b/i.exec(plain)?.[1] ?? /\b(\d{6})\b/.exec(plain)?.[1] ?? null;
}

function base32(secret: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secret.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const i = alphabet.indexOf(c);
    if (i < 0) throw new Error("bad secret");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** 6-digit 2FA code (TOTP, 30 s, like Google Authenticator) from a Base32 secret. null if the secret is not valid. */
export async function totp(secret: string, now = Date.now()): Promise<string | null> {
  let key: Uint8Array;
  try {
    key = base32(secret);
  } catch {
    return null;
  }
  if (key.length < 10) return null;
  const counter = Math.floor(now / 1000 / 30);
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setUint32(4, counter);
  new DataView(msg.buffer).setUint32(0, Math.floor(counter / 2 ** 32));
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", k, msg));
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}
