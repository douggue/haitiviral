import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "./db";
import { DEFAULT_EXCHANGE, type ExchangePricing } from "./amount";

export type Settings = {
  /** Recent sales popup on the products ticked in Admin → Trust */
  salesPopupEnabled: boolean;
  /** Popups per visit (2–3 feels natural; max 5) */
  salesPopupPerVisit: number;
  /** "Stock is low" shows when a code product has this many codes left or fewer (mode "auto") */
  lowStockLimit: number;
  /** HTG per 1 USD (mid rate) */
  htgPerUsd: number;
  /** Exchange spread applied against the customer, in basis points */
  exchangeSpreadBps: number;
  /** Flat exchange fee in basis points of the source amount */
  exchangeFeeBps: number;
  exchangeQuoteSeconds: number;
  minDepositHtg: number;
  maxDepositHtg: number;
  /** Manual deposits at or above this amount are held before becoming spendable */
  holdThresholdHtg: number;
  holdHours: number;
  /** Accounts younger than this many days get lower limits */
  newAccountDays: number;
  newAccountDailyLimitHtg: number;
  /** Orders at or above this total go to manual review before codes are released */
  reviewOrderThresholdHtg: number;
  natcashRecipientName: string;
  natcashRecipientPhone: string;
  natcashInstructions: Record<string, string>;
  /** Optional NatCash QR image customers scan on the deposit page */
  natcashQrUrl: string;
  moncashEnabled: boolean;
  natcashEnabled: boolean;
  whatsappNumber: string;
  supportHours: string;
  businessAddress: string;
  businessName: string;
  socialFacebook: string;
  socialInstagram: string;
  socialTiktok: string;
  announcement: { enabled: boolean; text: Record<string, string>; link: string; startsAt?: string; endsAt?: string };
  /** Header and footer links (Admin → Navigation). Empty = built-in links. */
  navigation: { header: NavLink[]; footer: NavLink[] };
  newsletterEnabled: boolean;
  /** Customers must confirm their email before ordering, depositing or exchanging (only while email sending is on) */
  requireEmailVerification: boolean;
  /** New accounts on a browser already used by this many other accounts are flagged for review */
  maxAccountsPerDevice: number;
  /** Brand images (URLs). Empty = built-in logo / default artwork. */
  logoUrl: string;
  logoDarkUrl: string;
  /** Wallet adjustments at or above this HTG-equivalent amount need a second staff approval */
  approvalThresholdHtg: number;
  /** Paid orders not delivered after this many hours are refunded to the wallet automatically (0 = off) */
  autoRefundHours: number;
  referralEnabled: boolean;
  referralRewardHtg: number;
  referralMinOrderHtg: number;
  heroImageUrl: string;
  ogImageUrl: string;
  homepage: unknown;
  homepageDraft: unknown;
  homepageHistory: { at: string; by: string; config: unknown }[];
  theme: ThemeConfig;
  themeHistory: { at: string; by: string; theme: ThemeConfig }[];
  /** Rate and fee table shared by every "customer enters the amount" product (Admin → Money exchange) */
  moneyExchange: ExchangePricing;
};

export type { ExchangePricing } from "./amount";

export type NavLink = { label: Record<string, string>; href: string };

export type MotionStyle = "calm" | "lively" | "neon";

export type ThemeConfig = {
  /** Accent in light mode (buttons, links) */
  primary: string;
  /** Accent in dark mode */
  primaryDark: string;
  /** Dark mode cards and panels */
  navy: string;
  /** Dark mode page background and the hero */
  midnight: string;
  /** Light mode page background */
  lightBg: string;
  radius: number;
  /** Master switch; visitors who ask for reduced motion never get animations */
  animations: boolean;
  /** What visitors see before they pick light or dark themselves */
  defaultMode: "dark" | "light";
  motion: MotionStyle;
  /** Strength of the blue glow behind the hero, cards and buttons (0 = off, 100 = strong) */
  glow: number;
  /** "gaming" = angular display face for headings, "plain" = the body face everywhere */
  displayFont: "gaming" | "plain";
  heroGrid: boolean;
  /** Words in the scrolling band under the hero, per language, separated by commas. Empty = no band. */
  marquee: Record<string, string>;
};

export const DEFAULT_THEME: ThemeConfig = {
  primary: "#1467F5",
  primaryDark: "#2F74FF",
  navy: "#0E1830",
  midnight: "#060B1A",
  lightBg: "#F3F6FD",
  radius: 16,
  animations: true,
  defaultMode: "dark",
  motion: "lively",
  glow: 60,
  displayFont: "gaming",
  heroGrid: true,
  marquee: {
    ht: "Rechaj jwèt, Kat kado, Abònman, Livrezon touswit, MonCash, NatCash",
    fr: "Recharges de jeux, Cartes cadeaux, Abonnements, Livraison immédiate, MonCash, NatCash",
    en: "Game top-ups, Gift cards, Subscriptions, Instant delivery, MonCash, NatCash",
    es: "Recargas de juegos, Tarjetas de regalo, Suscripciones, Entrega inmediata, MonCash, NatCash",
  },
};

/** Saved themes from before these settings existed get the new defaults for anything missing. */
export function fullTheme(t: Partial<ThemeConfig> | undefined): ThemeConfig {
  return { ...DEFAULT_THEME, ...(t ?? {}), marquee: { ...DEFAULT_THEME.marquee, ...(t?.marquee ?? {}) } };
}

// Amounts in minor units (centimes).
export const DEFAULT_SETTINGS: Settings = {
  salesPopupEnabled: true,
  salesPopupPerVisit: 3,
  lowStockLimit: 5,
  htgPerUsd: 131.5,
  exchangeSpreadBps: 150,
  exchangeFeeBps: 0,
  exchangeQuoteSeconds: 120,
  minDepositHtg: 10_000,
  maxDepositHtg: 10_000_000,
  holdThresholdHtg: 2_500_000,
  holdHours: 24,
  newAccountDays: 3,
  newAccountDailyLimitHtg: 1_500_000,
  reviewOrderThresholdHtg: 2_000_000,
  natcashRecipientName: "Haiti Gaming",
  natcashRecipientPhone: "+509 0000 0000",
  natcashInstructions: {},
  natcashQrUrl: "",
  moncashEnabled: true,
  natcashEnabled: true,
  whatsappNumber: "50900000000",
  supportHours: "Lun–Sam 8:00–20:00",
  businessAddress: "Port-au-Prince, Haïti",
  businessName: "Haiti Gaming",
  socialFacebook: "",
  socialInstagram: "",
  socialTiktok: "",
  announcement: { enabled: false, text: {}, link: "" },
  logoUrl: "",
  logoDarkUrl: "",
  approvalThresholdHtg: 1_000_000,
  autoRefundHours: 24,
  referralEnabled: false,
  referralRewardHtg: 10_000,
  referralMinOrderHtg: 50_000,
  heroImageUrl: "",
  ogImageUrl: "",
  homepage: null,
  homepageDraft: null,
  homepageHistory: [],
  theme: DEFAULT_THEME,
  themeHistory: [],
  navigation: { header: [], footer: [] },
  newsletterEnabled: false,
  requireEmailVerification: true,
  maxAccountsPerDevice: 3,
  moneyExchange: DEFAULT_EXCHANGE,
};

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.siteSetting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) merged[r.key] = r.value;
  return merged as Settings;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
  try {
    revalidateTag("settings");
  } catch {
    // outside a Next.js request (seed/scripts): the 60-second expiry covers it
  }
}

/**
 * Cached copy for rendering public pages (logo, menus, announcement, contact numbers).
 * Refreshed as soon as staff save settings, and at most 60 seconds old otherwise.
 * Money paths (deposits, exchange, limits, checkout) keep using getSettings(), which always reads the database.
 */
const cachedSettings = unstable_cache(getSettings, ["site-settings"], { tags: ["settings"], revalidate: 60 });
export const getDisplaySettings = cache(() => cachedSettings());
