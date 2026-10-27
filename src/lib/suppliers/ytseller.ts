import "server-only";
import { prisma } from "../db";
import { encrypt, hmac } from "../crypto";
import { smmCall } from "./smm";
import { lineQuantity, refundUndelivered, smmInclude, type SmmOrder } from "./smm-orders";
import { smmOutcome } from "./smm";
import { getSettings } from "../settings";

/**
 * Accounts provider (YTSeller, https://ytseller.com/api/v2): same form POST as SMM panels (key + action), with
 *   products            list with per-piece price, stock and "require"
 *   add_product_order   product, quantity, require, trans_id (our reference: sending it again never buys twice)
 *   product_order_status  Pending / In progress / Completed / Partial / Canceled, remains, charge
 *   result_product      the delivered lines (logins, numbers…)
 *   balance
 * Delivered lines are saved encrypted as codes on the order line, shown only to the customer.
 */
export const isAccounts = (preset: string) => preset === "ytseller" || preset === "ytseller_mock";
export const ACCOUNT_PRESETS = ["ytseller", "ytseller_mock"];

type Row = { id: string; baseUrl: string; secrets: string | null };
export type YtProduct = { product: string; name: string; category: string; rate: number; min: number; max: number; type: string; status: string; inventory: number | null; require: string | null; description: string | null };

const int = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));

export async function ytProducts(s: Row): Promise<YtProduct[]> {
  const r = await smmCall(s, "products");
  if (r.error || !Array.isArray(r.data)) throw new Error(r.error ?? "Unexpected products reply");
  return (r.data as Record<string, unknown>[]).map((x) => ({
    product: String(x.product ?? ""),
    name: String(x.name ?? ""),
    category: String(x.category ?? ""),
    rate: Number(x.rate ?? 0),
    min: int(x.min) ?? 1,
    max: int(x.max) ?? 1,
    type: String(x.type ?? ""),
    status: String(x.status ?? ""),
    inventory: int(x.inventory),
    require: typeof x.require === "string" && x.require.trim() ? x.require.trim() : null,
    description: typeof x.description === "string" ? x.description : null,
  })).filter((x) => x.product);
}

/** In stock unless the provider says otherwise (inventory null = made on order). */
export function inStock(p: Pick<YtProduct, "status" | "inventory">) {
  return !/out/i.test(p.status) && (p.inventory === null || p.inventory > 0);
}

const CHECK_MIN = [1, 2, 3, 5, 10, 15, 30];
const GIVE_UP_MS = 3 * 24 * 3_600_000;
const nextCheck = (checks: number) => new Date(Date.now() + CHECK_MIN[Math.min(checks, CHECK_MIN.length - 1)] * 60_000);

/** Send one line. trans_id = our reference, so a timeout can be retried without paying twice. */
export async function sendAccountOrder(so: SmmOrder): Promise<void> {
  const fields = (so.orderItem.fieldValues ?? {}) as Record<string, string>;
  const product = so.sku ?? so.orderItem.variant.supplierSku ?? "";
  const r = await smmCall(so.supplier, "add_product_order", { product, quantity: lineQuantity(fields), require: fields.require || undefined, trans_id: so.ref }, so.id);
  const id = r.data && typeof r.data === "object" ? (r.data as { order?: unknown }).order : undefined;
  if (!r.error && id !== undefined && id !== null && String(id) !== "") {
    const ps = await prisma.providerService.findUnique({ where: { supplierId_serviceId: { supplierId: so.supplierId, serviceId: product } }, select: { rate: true } });
    const costUsd = ps ? Number(ps.rate) * lineQuantity(fields) : null;
    const { htgPerUsd } = await getSettings();
    await prisma.supplierOrder.update({ where: { id: so.id }, data: { status: "PENDING", supplierOrderId: String(id), message: null, lockedUntil: null, nextCheckAt: nextCheck(0), ...(costUsd !== null ? { costUsd, costHtg: Math.round(costUsd * htgPerUsd * 100) } : {}) } });
    return;
  }
  const unsure = r.http === null || (r.http !== null && r.http >= 500) || r.http === 429 || r.error === "The provider did not answer with JSON";
  if (unsure) {
    // Same trans_id on the next try returns the same order: safe to try again later.
    await prisma.supplierOrder.update({ where: { id: so.id }, data: { status: "UNKNOWN", message: `No clear answer (${r.error ?? "?"}): will ask again with the same reference`.slice(0, 500), lockedUntil: null, nextCheckAt: nextCheck(so.checks), checks: { increment: 1 } } });
    return;
  }
  await prisma.$transaction([
    prisma.supplierOrder.update({ where: { id: so.id }, data: { status: "FAILED", message: (r.error ?? "Refused").slice(0, 500), lockedUntil: null, nextCheckAt: null } }),
    prisma.orderEvent.create({ data: { orderId: so.orderItem.orderId, status: "PROCESSING", note: `Accounts provider refused: ${r.error ?? "no reason"}`.slice(0, 500) } }),
  ]);
  await refundUndelivered(so, lineQuantity(fields), `Provider refused: ${r.error ?? "no reason"}`);
}

/** Save delivered lines as encrypted codes on the order line (never twice: one hash per line). */
async function saveLines(so: SmmOrder, lines: string[]) {
  await prisma.$transaction(async (tx) => {
    for (const [i, line] of lines.entries()) {
      const codeHash = hmac(`yt:${so.id}:${i}`);
      if (await tx.codeItem.findUnique({ where: { codeHash } })) continue;
      await tx.codeItem.create({ data: { variantId: so.orderItem.variantId, codeEncrypted: encrypt(line), codeHash, status: "ASSIGNED", assignedAt: new Date(), orderItemId: so.orderItemId, batchLabel: `supplier:${so.supplier.name}` } });
    }
  });
}

/** Check one line. Returns the order id when it is finished (fully or partly delivered). */
export async function checkAccountOrder(so: SmmOrder): Promise<string | null> {
  const fields = (so.orderItem.fieldValues ?? {}) as Record<string, string>;
  const qty = lineQuantity(fields);
  const base = { lockedUntil: null, checks: { increment: 1 } } as const;
  if (!so.supplierOrderId) {
    // Not sure it was placed: send again with the same trans_id (returns the same order if it exists).
    await sendAccountOrder(so);
    return null;
  }
  const r = await smmCall(so.supplier, "product_order_status", { order: so.supplierOrderId }, so.id);
  const d = (r.data ?? {}) as { status?: unknown; remains?: unknown; charge?: unknown };
  if (r.error || typeof d.status !== "string") {
    const tooOld = Date.now() - so.createdAt.getTime() > GIVE_UP_MS;
    await prisma.supplierOrder.update({ where: { id: so.id }, data: { ...base, message: (r.error ?? "No status").slice(0, 500), nextCheckAt: tooOld ? null : nextCheck(so.checks) } });
    return null;
  }
  const outcome = smmOutcome(d.status);
  const charge = Number(d.charge);
  const cost = Number.isFinite(charge) && charge >= 0 ? { costUsd: charge, costHtg: Math.round(charge * (await getSettings()).htgPerUsd * 100) } : {};
  if (outcome === "done" || outcome === "partial") {
    const res = await smmCall(so.supplier, "result_product", { order: so.supplierOrderId }, so.id);
    const lines = Array.isArray((res.data as { result?: unknown })?.result) ? ((res.data as { result: unknown[] }).result.map((x) => String(x)).filter((x) => x.trim())) : [];
    if (!lines.length) {
      await prisma.supplierOrder.update({ where: { id: so.id }, data: { ...base, status: "UNKNOWN", message: "Completed but no lines yet", nextCheckAt: nextCheck(so.checks) } });
      return null;
    }
    await saveLines(so, lines);
    const remains = Math.max(0, qty - lines.length, outcome === "partial" ? int(d.remains) ?? 0 : 0);
    if (remains > 0) {
      const claim = await prisma.supplierOrder.updateMany({ where: { id: so.id, status: { in: ["PENDING", "UNKNOWN", "SENDING"] } }, data: { status: "SUCCESS", remains, ...cost, lockedUntil: null, nextCheckAt: null, message: `Provider: ${d.status}` } });
      if (claim.count === 1) await refundUndelivered(so, remains, "Partly delivered by the provider");
      return so.orderItem.orderId;
    }
    await prisma.$transaction([
      prisma.supplierOrder.update({ where: { id: so.id }, data: { ...base, ...cost, remains: 0, status: "SUCCESS", message: null, nextCheckAt: null } }),
      prisma.orderItem.update({ where: { id: so.orderItemId }, data: { status: "DELIVERED" } }),
    ]);
    return so.orderItem.orderId;
  }
  if (outcome === "canceled") {
    const claim = await prisma.supplierOrder.updateMany({ where: { id: so.id, status: { in: ["PENDING", "UNKNOWN", "SENDING"] } }, data: { status: "FAILED", remains: qty, lockedUntil: null, nextCheckAt: null, message: `Provider: ${d.status}` } });
    if (claim.count === 1) await refundUndelivered(so, qty, "Canceled by the provider");
    return null;
  }
  const tooOld = Date.now() - so.createdAt.getTime() > GIVE_UP_MS;
  await prisma.supplierOrder.update({ where: { id: so.id }, data: { ...base, ...cost, status: "PENDING", remains: int(d.remains), message: tooOld ? "Still not delivered after 3 days: check on the provider's site" : d.status, nextCheckAt: tooOld ? null : nextCheck(so.checks) } });
  return null;
}

/** Cron (or one line on demand): check every due line. */
export async function runAccountChecks(ids?: string[]): Promise<string[]> {
  const due = await prisma.supplierOrder.findMany({
    where: ids ? { id: { in: ids }, status: { in: ["PENDING", "UNKNOWN"] } } : { status: { in: ["PENDING", "UNKNOWN"] }, nextCheckAt: { lte: new Date() }, supplier: { preset: { in: ACCOUNT_PRESETS } } },
    include: smmInclude,
    take: ids ? undefined : 100,
  });
  const finished: string[] = [];
  for (const so of due) {
    const done = await checkAccountOrder(so).catch((e) => (console.error("accounts check failed", so.id, e), null));
    if (done) finished.push(done);
  }
  return finished;
}
