import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { randomToken } from "./crypto";
import { getSettings } from "./settings";
import { chargeOrder } from "./wallet";
import { assertWithinNewAccountLimit, flag } from "./risk";
import { notify } from "./notify";
import { addEvent, fulfillOrder, OrderError } from "./orders";
import { accountPrice, parseAccountMeta, type AccountMeta } from "./accounts";
import { smmBalance } from "./suppliers/smm";
import { inStock, isAccounts, ytProducts } from "./suppliers/ytseller";

/**
 * Accounts & SMS numbers shop, sold through an accounts provider (YTSeller).
 * - sync: the provider's products (per-piece price, stock, "require") go to ProviderService; our products follow
 *   the stock (sold out / back) and pause themselves if the cost rises above our price.
 * - staff pick a provider product in Admin → Accounts & SMS: it becomes one of our products (own name, text, price).
 * - customers buy from the wallet; delivered lines are saved encrypted and shown only on their order page.
 */

export const ACCOUNT_CATEGORIES = {
  accounts: { name: { ht: "Kont", fr: "Comptes" }, sortOrder: 900 },
  sms: { name: { ht: "Nimewo SMS", fr: "Numéros SMS" }, sortOrder: 901 },
} as const;

export async function syncAccountProducts(supplierId: string) {
  const s = await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
  if (!isAccounts(s.preset)) throw new Error("Not an accounts provider");
  const list = await ytProducts(s);
  const now = new Date();
  const existing = new Map((await prisma.providerService.findMany({ where: { supplierId } })).map((x) => [x.serviceId, x]));
  for (const x of list) {
    const data = {
      name: x.name.slice(0, 500), category: x.category.slice(0, 200), type: x.type.slice(0, 60), rate: x.rate, min: x.min, max: x.max,
      stock: inStock(x) ? x.inventory : 0, require: x.require?.slice(0, 200) ?? null, desc: x.description?.slice(0, 2000) ?? null, seenAt: now, removedAt: null,
    };
    const old = existing.get(x.product);
    if (!old) await prisma.providerService.create({ data: { supplierId, serviceId: x.product, ...data } });
    else await prisma.providerService.update({ where: { id: old.id }, data: { ...data, ...(Number(old.rate) !== x.rate ? { prevRate: old.rate, rateChangedAt: now } : {}) } });
  }
  const removed = await prisma.providerService.updateMany({ where: { supplierId, removedAt: null, seenAt: { lt: now } }, data: { removedAt: now, stock: 0 } });
  await smmBalance(s).catch(() => null);
  const changed = await applyAccountStock(supplierId);
  return { total: list.length, removed: removed.count, changed };
}

/**
 * Our products follow the provider: sold out when it has none (or stopped listing it), and also when its cost
 * went above our price (no sale at a loss). Back on sale automatically when both are fine again.
 * Staff-paused products (isActive false) are left alone.
 */
export async function applyAccountStock(supplierId?: string) {
  const { htgPerUsd } = await getSettings();
  const variants = await prisma.productVariant.findMany({ where: { account: { not: Prisma.DbNull }, supplierId: supplierId ?? { not: null } } });
  let changed = 0;
  for (const v of variants) {
    const ps = await prisma.providerService.findUnique({ where: { supplierId_serviceId: { supplierId: v.supplierId!, serviceId: v.supplierSku ?? "" } } });
    const cost = ps ? Math.round(Number(ps.rate) * htgPerUsd * 100) : Infinity;
    const out = !ps || !!ps.removedAt || ps.stock === 0 || cost >= (v.salePriceHtg ?? v.priceHtg);
    if (out !== v.soldOut) {
      await prisma.productVariant.update({ where: { id: v.id }, data: { soldOut: out } });
      changed++;
    }
  }
  return changed;
}

/** Every accounts provider (cron, hourly: stock moves fast). */
export async function syncAllAccountProviders() {
  const suppliers = await prisma.supplier.findMany({ where: { isEnabled: true, preset: { in: ["ytseller", "ytseller_mock"] } } });
  const out: Record<string, unknown> = {};
  for (const s of suppliers) out[s.name] = await syncAccountProducts(s.id).catch((e) => ({ error: e instanceof Error ? e.message : "failed" }));
  return out;
}

function slugify(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";
}

/** Staff: put a provider product on sale. */
export async function createAccountProduct(input: {
  supplierId: string; productId: string; kind: "account" | "sms"; name: Record<string, string>; about: Record<string, string>;
  priceHtg?: number; warrantyHours?: number; delivery?: "instant" | "24h"; requireLabel?: Record<string, string> | null;
}) {
  const s = await getSettings();
  const ps = await prisma.providerService.findUniqueOrThrow({ where: { supplierId_serviceId: { supplierId: input.supplierId, serviceId: input.productId } } });
  const cat = ACCOUNT_CATEGORIES[input.kind === "sms" ? "sms" : "accounts"];
  const catSlug = input.kind === "sms" ? "sms" : "accounts";
  const category = await prisma.category.upsert({ where: { slug: catSlug }, create: { slug: catSlug, name: cat.name, sortOrder: cat.sortOrder }, update: {} });
  const base = slugify(input.name.fr || input.name.ht || ps.name);
  let slug = base;
  for (let i = 2; await prisma.product.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  const meta: AccountMeta = {
    kind: input.kind, min: ps.min, max: ps.max,
    delivery: input.delivery ?? (ps.type === "api" || ps.stock === null ? "24h" : "instant"),
    require: ps.require ? input.requireLabel ?? { ht: ps.require, fr: ps.require } : null,
    warrantyHours: input.warrantyHours ?? (input.kind === "sms" ? 0 : s.accountWarrantyHours),
    about: input.about,
  };
  const price = input.priceHtg ?? accountPrice(Number(ps.rate), s.htgPerUsd, s.accountMarginPct);
  const product = await prisma.product.create({
    data: {
      slug, categoryId: category.id, name: input.name, description: input.about, isPublished: true, fulfillmentType: "SUPPLIER_API",
      tags: [`acct:${slugify(ps.category)}`],
      variants: { create: [{ name: input.name, priceHtg: price, supplierId: input.supplierId, supplierSku: input.productId, account: meta as unknown as Prisma.InputJsonValue }] },
    },
  });
  await applyAccountStock(input.supplierId);
  return product;
}

/** Products on sale, for the customer pages. */
export async function listAccountProducts() {
  const rows = await prisma.product.findMany({
    where: { isPublished: true, category: { slug: { in: ["accounts", "sms"] } } },
    include: { category: true, variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.flatMap((p) => {
    const v = p.variants[0];
    const meta = v && parseAccountMeta(v.account);
    return v && meta ? [{ product: p, variant: v, meta }] : [];
  });
}

/** Stock the customer can buy now (provider stock, capped by max); null = made on order. */
export async function stockFor(v: { supplierId: string | null; supplierSku: string | null }) {
  if (!v.supplierId || !v.supplierSku) return 0;
  const ps = await prisma.providerService.findUnique({ where: { supplierId_serviceId: { supplierId: v.supplierId, serviceId: v.supplierSku } }, select: { stock: true } });
  return ps ? ps.stock : 0;
}

/**
 * Buy N pieces from the wallet. Checked here (never trusted from the browser): price, limits, stock, the
 * provider's required input, and the warranty consent. One order line: unitPrice = total, fieldValues.quantity = N
 * (same as social services, so partial deliveries refund the missing pieces automatically).
 */
export async function createAccountOrder(input: { userId: string; variantId: string; quantity: number; require?: string; accepted: boolean }) {
  const s = await getSettings();
  if (!s.accountsEnabled) throw new OrderError("unavailable");
  const v = await prisma.productVariant.findFirst({ where: { id: input.variantId, isActive: true, product: { isPublished: true } }, include: { product: true, supplier: true } });
  const meta = parseAccountMeta(v?.account);
  if (!v || !meta || v.soldOut || !v.supplier?.isEnabled) throw new OrderError("unavailable");
  const qty = input.quantity;
  if (!Number.isInteger(qty) || qty < meta.min || qty > meta.max) throw new OrderError("invalid_quantity");
  const stock = await stockFor(v);
  if (stock !== null && qty > stock) throw new OrderError("out_of_stock");
  const fieldValues: Record<string, string> = { quantity: String(qty) };
  if (meta.require) {
    const r = (input.require ?? "").trim();
    if (!r || r.length > 200) throw new OrderError("missing_field");
    fieldValues.require = r;
  }
  if (!input.accepted) throw new OrderError("terms_not_accepted");
  fieldValues.termsAcceptedAt = new Date().toISOString();
  fieldValues.warrantyHours = String(meta.warrantyHours);

  const total = (v.salePriceHtg ?? v.priceHtg) * qty;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  if (user.status !== "ACTIVE") throw new OrderError("account_restricted");
  const variantName = Object.fromEntries(Object.entries(v.name as Record<string, string>).map(([l, n]) => [l, `${n} × ${qty}`]));
  const order = await prisma.$transaction(async (tx) => {
    await assertWithinNewAccountLimit(tx, user, total, s);
    const created = await tx.order.create({
      data: {
        userId: input.userId, currency: "HTG", subtotal: total, total, paymentMethod: "WALLET", accessToken: randomToken(),
        items: { create: [{ variantId: v.id, productName: v.product.name as Prisma.InputJsonValue, variantName, quantity: 1, unitPrice: total, fieldValues }] },
      },
    });
    await addEvent(tx, created.id, "AWAITING_PAYMENT", "Payment method: WALLET");
    if (total >= s.reviewOrderThresholdHtg) await flag(tx, "High-value order: review before release", { userId: input.userId, orderId: created.id });
    await chargeOrder(tx, created);
    await tx.order.update({ where: { id: created.id }, data: { status: "PAID", paidAt: new Date() } });
    await addEvent(tx, created.id, "PAID", "Paid from wallet");
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  await notify(order.userId, "order_paid", { number: order.number }, `/account/orders/${order.id}`);
  await fulfillOrder(order.id);
  return order;
}
