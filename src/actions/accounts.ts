"use server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertStaff, assertUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { setSetting } from "@/lib/settings";
import { parseAmount } from "@/lib/money";
import { mustVerifyEmail } from "@/lib/verify-email";
import { OrderError } from "@/lib/orders";
import { InsufficientFundsError } from "@/lib/ledger";
import { parseAccountMeta } from "@/lib/accounts";
import { applyAccountStock, createAccountOrder, createAccountProduct, syncAccountProducts } from "@/lib/accounts-shop";

type R = { ok: true; message?: string } | { ok: false; error: string };
const fail = (e: unknown): R => ({ ok: false, error: e instanceof Error ? e.message : "Unexpected error" });
const str = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? "").trim().slice(0, max);
const pair = (f: FormData, k: string, max = 2000) => ({ ht: str(f, `${k}_ht`, max), fr: str(f, `${k}_fr`, max) });
const hours = (f: FormData) => Math.min(24 * 90, Math.max(0, Math.round(Number(str(f, "warrantyHours")) || 0)));

function refresh() {
  revalidatePath("/admin/accounts");
  revalidatePath("/[locale]/accounts", "layout");
}

export async function syncAccountsAction(supplierId: string): Promise<R> {
  try {
    const staff = await assertStaff("catalog.manage");
    const r = await syncAccountProducts(supplierId);
    await audit(staff.id, "accounts.sync", "Supplier", supplierId, r);
    refresh();
    return { ok: true, message: `${r.total} products · ${r.changed} of ours changed (sold out / back)` };
  } catch (e) {
    return fail(e);
  }
}

/** Put a provider product on sale with our own name, text and price. */
export async function sellAccountProduct(supplierId: string, productId: string, form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("catalog.manage");
    const name = pair(form, "name", 120);
    if (!name.ht || !name.fr) return { ok: false, error: "Give the name in Kreyòl and French" };
    const price = parseAmount(str(form, "price"));
    const kind = str(form, "kind") === "sms" ? "sms" : "account";
    const req = pair(form, "require", 120);
    const p = await createAccountProduct({
      supplierId, productId, kind, name, about: pair(form, "about"), priceHtg: price ?? undefined, warrantyHours: hours(form),
      delivery: str(form, "delivery") === "24h" ? "24h" : "instant", requireLabel: req.ht && req.fr ? req : null,
    });
    await audit(staff.id, "accounts.sell", "Product", p.id, { supplierId, productId });
    refresh();
    return { ok: true, message: "On sale" };
  } catch (e) {
    return fail(e);
  }
}

export async function updateAccountProduct(variantId: string, form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("catalog.manage");
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    const meta = parseAccountMeta(v.account);
    if (!meta) return { ok: false, error: "Not an account product" };
    const name = pair(form, "name", 120);
    if (!name.ht || !name.fr) return { ok: false, error: "Give the name in Kreyòl and French" };
    const price = parseAmount(str(form, "price"));
    if (!price) return { ok: false, error: "Enter a price" };
    const req = pair(form, "require", 120);
    const next = { ...meta, about: pair(form, "about"), warrantyHours: hours(form), delivery: str(form, "delivery") === "24h" ? "24h" : "instant", require: meta.require ? (req.ht && req.fr ? req : meta.require) : null };
    await prisma.$transaction([
      prisma.productVariant.update({ where: { id: variantId }, data: { name, priceHtg: price, isActive: form.get("active") === "on", account: next as unknown as Prisma.InputJsonValue } }),
      prisma.product.update({ where: { id: v.productId }, data: { name, description: next.about } }),
    ]);
    await applyAccountStock(v.supplierId ?? undefined);
    await audit(staff.id, "accounts.update", "ProductVariant", variantId, { price });
    refresh();
    return { ok: true, message: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function removeAccountProduct(variantId: string): Promise<R> {
  try {
    const staff = await assertStaff("catalog.manage");
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    // Kept for past orders; just taken off the shop.
    await prisma.product.update({ where: { id: v.productId }, data: { isPublished: false } });
    await audit(staff.id, "accounts.remove", "ProductVariant", variantId);
    refresh();
    return { ok: true, message: "Removed from the shop" };
  } catch (e) {
    return fail(e);
  }
}

export async function saveAccountSettings(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("settings.manage");
    await setSetting("accountsEnabled", form.get("accountsEnabled") === "on");
    await setSetting("accountMarginPct", Math.min(500, Math.max(0, Math.round(Number(str(form, "accountMarginPct")) || 0))));
    await setSetting("accountWarrantyHours", hours(form));
    await audit(staff.id, "accounts.settings", "SiteSetting", "accounts");
    refresh();
    return { ok: true, message: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

/** Customer: buy accounts / SMS numbers from the wallet. */
export async function placeAccountOrder(input: { variantId: string; quantity: number; require?: string; accepted: boolean }): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  let user;
  try {
    user = await assertUser();
  } catch {
    return { ok: false, error: "signin" };
  }
  if (await mustVerifyEmail(user.id)) return { ok: false, error: "verify_email" };
  try {
    const order = await createAccountOrder({ userId: user.id, variantId: String(input.variantId).slice(0, 40), quantity: Number(input.quantity), require: String(input.require ?? "").slice(0, 200), accepted: !!input.accepted });
    return { ok: true, orderId: order.id };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code };
    if (e instanceof InsufficientFundsError) return { ok: false, error: "insufficient" };
    console.error("placeAccountOrder failed", e);
    return { ok: false, error: "generic" };
  }
}
