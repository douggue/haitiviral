/**
 * Demo catalog: one category per platform and example social media services sold in packages.
 * Names and prices are examples, not provider inventory. Pictures: public/demo (tools/make-demo-images.mjs). Safe to run twice (existing slugs are skipped).
 * Used by `npm run db:seed` and by the first-run setup page (/admin/setup).
 * Temporary: the services engine (link + any quantity, provider connector) replaces products in step 2.
 */
import type { FulfillmentType, PrismaClient } from "@prisma/client";

const L = (ht: string, fr: string) => ({ ht, fr });
const htg = (n: number) => Math.round(n * 100);

const linkField = (kind: "profile" | "post") => ({
  key: "link",
  label: kind === "profile" ? L("Lyen pwofil ou", "Lien de votre profil") : L("Lyen videyo a oswa piblikasyon an", "Lien de la vidéo ou de la publication"),
  type: "text",
  required: true,
  placeholder: kind === "profile" ? "https://www.tiktok.com/@non" : "https://www.tiktok.com/@non/video/…",
});

const categories = [
  { slug: "tiktok", icon: "🎵", name: L("TikTok", "TikTok"), sortOrder: 1 },
  { slug: "instagram", icon: "📸", name: L("Instagram", "Instagram"), sortOrder: 2 },
  { slug: "youtube", icon: "▶️", name: L("YouTube", "YouTube"), sortOrder: 3 },
  { slug: "facebook", icon: "👍", name: L("Facebook", "Facebook"), sortOrder: 4 },
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
};

const pack = (n: number, ht: string, fr: string) => L(`${n.toLocaleString("en-US")} ${ht}`, `${n.toLocaleString("fr-FR")} ${fr}`);

/** One product per platform + service; each package size is an option. Prices in HTG. */
function service(
  platform: string, accent: string, slugPart: string, ht: string, fr: string, kind: "profile" | "post",
  sizes: [number, number][], delivery: ReturnType<typeof L>, desc: ReturnType<typeof L>, featured = false,
): SeedProduct {
  const name = categories.find((c) => c.slug === platform)!.name.ht;
  return {
    slug: `${platform}-${slugPart}`, category: platform, accent, featured, fulfillment: "MANUAL",
    name: L(`${name} ${ht[0].toUpperCase()}${ht.slice(1)}`, `${fr[0].toUpperCase()}${fr.slice(1)} ${name}`),
    description: desc, delivery, fields: [linkField(kind)],
    variants: sizes.map(([n, price]) => ({ name: pack(n, ht, fr), price })),
  };
}

const hours = (a: number, b: number) => L(`Kòmanse nan ${a} a ${b} èdtan`, `Démarre en ${a} à ${b} heures`);
const minutes = L("Kòmanse nan kèk minit", "Démarre en quelques minutes");
const followersDesc = L(
  "Abòne pou pwofil ou. Kont lan dwe piblik. Nou pa janm mande modpas ou. Refill 30 jou si gen kèk ki tonbe.",
  "Des abonnés pour votre profil. Le compte doit être public. Nous ne demandons jamais votre mot de passe. Refill 30 jours en cas de baisse.",
);
const likesDesc = L(
  "Like pou yon videyo oswa yon piblikasyon. Kole lyen VIDEYO a, pa lyen pwofil la.",
  "Des likes pour une vidéo ou une publication. Collez le lien de la VIDÉO, pas celui du profil.",
);
const viewsDesc = L("Vi pou yon videyo. Livrezon rapid.", "Des vues pour une vidéo. Livraison rapide.");

const products: SeedProduct[] = [
  service("tiktok", "#111111", "followers", "abòne", "abonnés", "profile", [[500, 210], [1000, 420], [5000, 1990]], hours(1, 2), followersDesc, true),
  service("tiktok", "#111111", "likes", "like", "likes", "post", [[500, 50], [1000, 95], [5000, 450]], minutes, likesDesc, true),
  service("tiktok", "#111111", "views", "vi", "vues", "post", [[1000, 20], [10000, 180], [50000, 850]], minutes, viewsDesc),
  service("instagram", "#C13584", "followers", "abòne", "abonnés", "profile", [[500, 280], [1000, 560], [5000, 2700]], hours(2, 4), followersDesc, true),
  service("instagram", "#C13584", "likes", "like", "likes", "post", [[500, 55], [1000, 110], [5000, 520]], minutes, likesDesc),
  service("instagram", "#C13584", "views", "vi reels", "vues reels", "post", [[1000, 25], [10000, 230], [50000, 1100]], minutes, viewsDesc),
  service("youtube", "#CC0000", "views", "vi", "vues", "post", [[1000, 260], [5000, 1250], [10000, 2400]], hours(2, 6), viewsDesc, true),
  service("youtube", "#CC0000", "subscribers", "abòne", "abonnés", "profile", [[100, 240], [500, 1150], [1000, 2250]], L("Kòmanse nan 1 jou", "Démarre sous 1 jour"), followersDesc),
  service("facebook", "#1877F2", "page-likes", "like paj", "j'aime de page", "profile", [[500, 210], [1000, 420], [5000, 2000]], hours(2, 6), followersDesc),
  service("facebook", "#1877F2", "video-views", "vi videyo", "vues vidéo", "post", [[1000, 45], [10000, 420], [50000, 2000]], minutes, viewsDesc),
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
    await prisma.product.create({
      data: {
        slug: p.slug,
        categoryId: cats[p.category],
        name: p.name,
        description: p.description,
        deliveryEstimate: p.delivery,
        accent: p.accent,
        image: `/demo/${p.slug}.png`,
        isPublished: true,
        isFeatured: !!p.featured,
        fulfillmentType: p.fulfillment,
        fields: p.fields,
        sortOrder: order++,
        variants: { create: p.variants.map((v, i) => ({ name: v.name, priceHtg: htg(v.price), salePriceHtg: v.sale ? htg(v.sale) : null, sortOrder: i })) },
      },
    });
  }
  return { categories: categories.length, products: products.length };
}
