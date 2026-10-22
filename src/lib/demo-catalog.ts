/**
 * Demo catalog: categories, products and DEMO gift-card codes.
 * Product names are illustrative examples, not confirmed supplier inventory. Safe to run twice (existing slugs are skipped).
 * Used by `npm run db:seed` and by the first-run setup page (/admin/setup).
 */
import { randomBytes } from "node:crypto";
import type { FulfillmentType, PrismaClient } from "@prisma/client";
import { encrypt, hmac } from "./crypto";

const L = (ht: string, fr: string, en: string, es: string) => ({ ht, fr, en, es });
const htg = (n: number) => Math.round(n * 100);

const playerIdField = {
  key: "playerId",
  label: L("ID jwè", "ID joueur", "Player ID", "ID de jugador"),
  type: "number",
  required: true,
  placeholder: "123456789",
};
const emailField = {
  key: "accountEmail",
  label: L("Imèl kont lan", "E-mail du compte", "Account email", "Correo de la cuenta"),
  type: "email",
  required: true,
};

const categories = [
  { slug: "game-top-ups", icon: "🎮", name: L("Rechaj jwèt", "Recharges de jeux", "Game top-ups", "Recargas de juegos"), sortOrder: 1 },
  { slug: "gift-cards", icon: "🎁", name: L("Kat kado", "Cartes cadeaux", "Gift cards", "Tarjetas de regalo"), sortOrder: 2 },
  { slug: "subscriptions", icon: "⭐", name: L("Abònman", "Abonnements", "Subscriptions", "Suscripciones"), sortOrder: 3 },
  { slug: "promotions", icon: "🔥", name: L("Pwomosyon", "Promotions", "Promotions", "Promociones"), sortOrder: 4 },
];

type SeedProduct = {
  slug: string;
  category: string;
  name: ReturnType<typeof L>;
  description: ReturnType<typeof L>;
  delivery: ReturnType<typeof L>;
  accent: string;
  featured?: boolean;
  fulfillment: FulfillmentType;
  fields: object[];
  variants: { name: ReturnType<typeof L>; price: number; sale?: number }[];
  codes?: number;
};

const instant = L("Touswit apre peman", "Immédiatement après paiement", "Instantly after payment", "Inmediatamente después del pago");
const fast = L("5 a 30 minit", "5 à 30 minutes", "5 to 30 minutes", "5 a 30 minutos");

const products: SeedProduct[] = [
  {
    slug: "free-fire-diamonds", category: "game-top-ups", accent: "#F59E0B", featured: true, fulfillment: "MANUAL",
    name: L("Dyaman Free Fire", "Diamants Free Fire", "Free Fire Diamonds", "Diamantes Free Fire"),
    description: L(
      "Rechaje dyaman Free Fire dirèkteman sou kont ou ak ID jwè ou. Ou pa bezwen bay modpas ou.",
      "Rechargez vos diamants Free Fire directement sur votre compte avec votre ID joueur. Aucun mot de passe requis.",
      "Top up Free Fire diamonds straight to your account using your player ID. No password needed.",
      "Recarga diamantes de Free Fire directo a tu cuenta con tu ID de jugador. No necesitas contraseña.",
    ),
    delivery: fast, fields: [playerIdField],
    variants: [
      { name: L("100 dyaman", "100 diamants", "100 diamonds", "100 diamantes"), price: 150 },
      { name: L("310 dyaman", "310 diamants", "310 diamonds", "310 diamantes"), price: 450 },
      { name: L("520 dyaman", "520 diamants", "520 diamonds", "520 diamantes"), price: 725, sale: 690 },
      { name: L("1060 dyaman", "1060 diamants", "1060 diamonds", "1060 diamantes"), price: 1450 },
      { name: L("Manm semèn", "Abonnement hebdo", "Weekly membership", "Membresía semanal"), price: 260 },
    ],
  },
  {
    slug: "pubg-mobile-uc", category: "game-top-ups", accent: "#EAB308", featured: true, fulfillment: "MANUAL",
    name: L("PUBG Mobile UC", "PUBG Mobile UC", "PUBG Mobile UC", "PUBG Mobile UC"),
    description: L(
      "Achte UC pou PUBG Mobile ak ID jwè ou.",
      "Achetez des UC pour PUBG Mobile avec votre ID joueur.",
      "Buy UC for PUBG Mobile using your player ID.",
      "Compra UC para PUBG Mobile con tu ID de jugador.",
    ),
    delivery: fast, fields: [playerIdField],
    variants: [
      { name: L("60 UC", "60 UC", "60 UC", "60 UC"), price: 165 },
      { name: L("325 UC", "325 UC", "325 UC", "325 UC"), price: 790 },
      { name: L("660 UC", "660 UC", "660 UC", "660 UC"), price: 1550 },
    ],
  },
  {
    slug: "google-play-gift-card", category: "gift-cards", accent: "#10B981", featured: true, fulfillment: "CODE_INVENTORY", codes: 8,
    name: L("Kat Google Play", "Carte Google Play", "Google Play Gift Card", "Tarjeta Google Play"),
    description: L(
      "Kòd Google Play (Etazini) pou achte aplikasyon, jwèt ak plis ankò.",
      "Code Google Play (États-Unis) pour applications, jeux et plus.",
      "Google Play code (US region) for apps, games and more.",
      "Código Google Play (EE. UU.) para apps, juegos y más.",
    ),
    delivery: instant, fields: [],
    variants: [
      { name: L("$10 USD", "10 $ US", "$10 USD", "$10 USD"), price: 1450 },
      { name: L("$25 USD", "25 $ US", "$25 USD", "$25 USD"), price: 3550 },
    ],
  },
  {
    slug: "playstation-store-card", category: "gift-cards", accent: "#1467F5", featured: true, fulfillment: "CODE_INVENTORY", codes: 6,
    name: L("Kat PlayStation Store", "Carte PlayStation Store", "PlayStation Store Card", "Tarjeta PlayStation Store"),
    description: L(
      "Kòd PlayStation Store (Etazini) pou jwèt, DLC ak PlayStation Plus.",
      "Code PlayStation Store (États-Unis) pour jeux, DLC et PlayStation Plus.",
      "PlayStation Store code (US region) for games, DLC and PlayStation Plus.",
      "Código PlayStation Store (EE. UU.) para juegos, DLC y PlayStation Plus.",
    ),
    delivery: instant, fields: [],
    variants: [
      { name: L("$10 USD", "10 $ US", "$10 USD", "$10 USD"), price: 1450 },
      { name: L("$25 USD", "25 $ US", "$25 USD", "$25 USD"), price: 3550 },
      { name: L("$50 USD", "50 $ US", "$50 USD", "$50 USD"), price: 6990 },
    ],
  },
  {
    slug: "steam-wallet-card", category: "gift-cards", accent: "#475569", fulfillment: "CODE_INVENTORY", codes: 5,
    name: L("Kat Steam", "Carte Steam", "Steam Wallet Card", "Tarjeta Steam"),
    description: L(
      "Mete lajan nan bous Steam ou pou achte jwèt PC.",
      "Ajoutez des fonds à votre portefeuille Steam pour acheter des jeux PC.",
      "Add funds to your Steam wallet to buy PC games.",
      "Agrega fondos a tu billetera de Steam para comprar juegos de PC.",
    ),
    delivery: instant, fields: [],
    variants: [
      { name: L("$5 USD", "5 $ US", "$5 USD", "$5 USD"), price: 750 },
      { name: L("$20 USD", "20 $ US", "$20 USD", "$20 USD"), price: 2850 },
    ],
  },
  {
    slug: "roblox-robux", category: "game-top-ups", accent: "#EF4444", fulfillment: "CODE_INVENTORY", codes: 4,
    name: L("Roblox Robux", "Roblox Robux", "Roblox Robux", "Roblox Robux"),
    description: L(
      "Kat Roblox pou jwenn Robux sou kont ou.",
      "Carte Roblox pour obtenir des Robux sur votre compte.",
      "Roblox card to get Robux on your account.",
      "Tarjeta Roblox para obtener Robux en tu cuenta.",
    ),
    delivery: instant, fields: [],
    variants: [
      { name: L("800 Robux", "800 Robux", "800 Robux", "800 Robux"), price: 1450 },
      { name: L("2000 Robux", "2000 Robux", "2000 Robux", "2000 Robux"), price: 3550 },
    ],
  },
  {
    slug: "netflix-subscription", category: "subscriptions", accent: "#DC2626", featured: true, fulfillment: "MANUAL",
    name: L("Abònman Netflix", "Abonnement Netflix", "Netflix Subscription", "Suscripción Netflix"),
    description: L(
      "Nou aktive abònman an sou imèl kont ou. Ekip nou an ap kontakte w si nou bezwen plis enfòmasyon.",
      "Nous activons l'abonnement sur l'e-mail de votre compte. Notre équipe vous contacte si besoin.",
      "We activate the subscription on your account email. Our team contacts you if anything else is needed.",
      "Activamos la suscripción en el correo de tu cuenta. Nuestro equipo te contacta si hace falta.",
    ),
    delivery: L("1 a 6 èdtan", "1 à 6 heures", "1 to 6 hours", "1 a 6 horas"), fields: [emailField],
    variants: [
      { name: L("1 mwa – Estanda", "1 mois – Standard", "1 month – Standard", "1 mes – Estándar"), price: 2100 },
      { name: L("1 mwa – Premium", "1 mois – Premium", "1 month – Premium", "1 mes – Premium"), price: 3100 },
    ],
  },
  {
    slug: "spotify-premium", category: "subscriptions", accent: "#16A34A", fulfillment: "MANUAL",
    name: L("Spotify Premium", "Spotify Premium", "Spotify Premium", "Spotify Premium"),
    description: L(
      "Mizik san piblisite. Nou aktive l sou imèl kont ou.",
      "Musique sans publicité. Activé sur l'e-mail de votre compte.",
      "Ad-free music, activated on your account email.",
      "Música sin anuncios, activada en el correo de tu cuenta.",
    ),
    delivery: L("1 a 6 èdtan", "1 à 6 heures", "1 to 6 hours", "1 a 6 horas"), fields: [emailField],
    variants: [
      { name: L("1 mwa", "1 mois", "1 month", "1 mes"), price: 1350 },
      { name: L("3 mwa", "3 mois", "3 months", "3 meses"), price: 3900, sale: 3650 },
    ],
  },
  {
    slug: "starter-gamer-bundle", category: "promotions", accent: "#8B5CF6", fulfillment: "MANUAL",
    name: L("Pake Debitan", "Pack Débutant", "Starter Gamer Bundle", "Paquete Inicial"),
    description: L(
      "310 dyaman Free Fire + manm semèn nan, nan yon sèl pri.",
      "310 diamants Free Fire + abonnement hebdo, à prix réduit.",
      "310 Free Fire diamonds plus the weekly membership, at one lower price.",
      "310 diamantes Free Fire + membresía semanal, a un precio menor.",
    ),
    delivery: fast, fields: [playerIdField],
    variants: [{ name: L("Pake a", "Le pack", "Bundle", "Paquete"), price: 710, sale: 640 }],
  },
];

export async function seedDemoCatalog(prisma: PrismaClient): Promise<{ categories: number; products: number }> {
  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, create: c, update: { name: c.name, icon: c.icon, sortOrder: c.sortOrder } });
  }
  const cats = Object.fromEntries((await prisma.category.findMany()).map((c) => [c.slug, c.id]));

  let order = 0;
  for (const p of products) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (existing) continue;
    const created = await prisma.product.create({
      data: {
        slug: p.slug,
        categoryId: cats[p.category],
        name: p.name,
        description: p.description,
        deliveryEstimate: p.delivery,
        accent: p.accent,
        isPublished: true,
        isFeatured: !!p.featured,
        fulfillmentType: p.fulfillment,
        fields: p.fields,
        sortOrder: order++,
        variants: { create: p.variants.map((v, i) => ({ name: v.name, priceHtg: htg(v.price), salePriceHtg: v.sale ? htg(v.sale) : null, sortOrder: i })) },
      },
      include: { variants: true },
    });
    if (p.codes) {
      for (const v of created.variants) {
        for (let i = 0; i < p.codes; i++) {
          const code = `DEMO-${p.slug.slice(0, 4).toUpperCase()}-${randomBytes(6).toString("hex").toUpperCase()}`;
          await prisma.codeItem.create({ data: { variantId: v.id, codeEncrypted: encrypt(code), codeHash: hmac(code), batchLabel: "seed-demo" } });
        }
      }
    }
  }
  // Filter tags for the demo products (safe to re-run)
  const TAGS: Record<string, string[]> = {
    "free-fire-diamonds": ["Android", "iOS"], "pubg-mobile-uc": ["Android", "iOS"], "google-play-gift-card": ["Android", "US region"],
    "playstation-store-card": ["PlayStation", "US region"], "steam-wallet-card": ["PC"], "roblox-robux": ["Android", "iOS", "PC"],
    "netflix-subscription": ["Streaming"], "spotify-premium": ["Streaming"], "starter-gamer-bundle": ["Android", "iOS"],
  };
  for (const [slug, tags] of Object.entries(TAGS)) await prisma.product.updateMany({ where: { slug, tags: { isEmpty: true } }, data: { tags } });
  return { categories: categories.length, products: products.length };
}
