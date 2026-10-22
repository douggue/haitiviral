import { Prisma, type Currency, type OrderStatus, type PaymentMethodKind } from "@prisma/client";
import { z } from "zod";
import { prisma, type Tx } from "./db";
import { decrypt, randomToken } from "./crypto";
import { priceIn } from "./money";
import { getSettings } from "./settings";
import { chargeOrder, refundOrder } from "./wallet";
import { assertWithinNewAccountLimit, flag } from "./risk";
import { notify } from "./notify";
import { t } from "./text";
import { moncashAvailable } from "./payments/moncash";
import { maybeRewardReferral } from "./referrals";
import { amountInRange, isExchangeProduct, quoteAmount } from "./amount";
import { hasOpenSupplierOrder, queueSupplierLines, sendQueued } from "./suppliers/orders";

export type FieldDef = {
  key: string;
  label: Record<string, string>;
  type: "text" | "email" | "number" | "tel";
  required: boolean;
  placeholder?: string;
};

export const cartItemSchema = z.object({
  variantId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(10),
  fields: z.record(z.string().max(200)).default({}),
  /** USD cents the customer typed, for "customer enters the amount" products */
  amount: z.number().int().positive().max(100_000_00).optional(),
});
export const cartSchema = z.array(cartItemSchema).min(1).max(20);
export type CartItemInput = z.infer<typeof cartItemSchema>;

export class OrderError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

function validateFields(defs: FieldDef[], values: Record<string, string>) {
  const clean: Record<string, string> = {};
  for (const d of defs) {
    const v = (values[d.key] ?? "").trim();
    if (d.required && !v) throw new OrderError("missing_field");
    if (v && d.type === "email" && !z.string().email().safeParse(v).success) throw new OrderError("invalid_field");
    if (v && d.type === "number" && !/^\d+$/.test(v)) throw new OrderError("invalid_field");
    if (v) clean[d.key] = v;
  }
  return clean; // unknown keys are dropped (data minimization)
}

export async function addEvent(tx: Tx, orderId: string, status: OrderStatus, note?: string, actorId?: string | null) {
  await tx.orderEvent.create({ data: { orderId, status, note, actorId: actorId ?? null } });
}

/**
 * Create an order with server-side price and field validation.
 * WALLET orders are charged immediately; MONCASH and NATCASH orders are charged in HTG once payment is verified.
 */
export async function createOrder(input: {
  userId: string;
  items: CartItemInput[];
  currency: Currency;
  method: PaymentMethodKind;
  manualMethodId?: string;
  recipientNote?: string;
}) {
  const settings = await getSettings();
  const currency: Currency = input.method === "WALLET" ? input.currency : "HTG";
  if (input.method === "MONCASH" && !moncashAvailable(settings.moncashEnabled)) throw new OrderError("method_unavailable");
  if (input.method === "NATCASH" && !settings.natcashEnabled) throw new OrderError("method_unavailable");
  if (input.method === "MANUAL") {
    const m = input.manualMethodId ? await prisma.manualMethod.findUnique({ where: { id: input.manualMethodId } }) : null;
    if (!m || !m.isEnabled || !m.allowOrders) throw new OrderError("method_unavailable");
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: input.items.map((i) => i.variantId) }, isActive: true, product: { isPublished: true } },
    include: { product: { include: { category: { select: { id: true, parentId: true } } } } },
  });

  const lines = input.items.map((item) => {
    const v = variants.find((x) => x.id === item.variantId);
    if (!v || v.soldOut) throw new OrderError("unavailable");
    const fieldValues = validateFields(v.product.fields as FieldDef[], item.fields);
    if (isExchangeProduct(settings.moneyExchange, v.product.category)) {
      // The price is never taken from the browser: recomputed from the amount, the fee table and today's rate.
      if (!item.amount || !amountInRange(settings.moneyExchange, item.amount)) throw new OrderError("invalid_amount");
      const q = quoteAmount(settings.moneyExchange, item.amount);
      const label = `$${(q.amount / 100).toFixed(2)}`;
      return {
        variantId: v.id,
        productName: v.product.name as Prisma.InputJsonValue,
        variantName: { ht: label, fr: label, en: label, es: label } as Prisma.InputJsonValue,
        quantity: item.quantity,
        unitPrice: currency === "USD" ? q.totalUsd : q.totalHtg,
        unitHtg: q.totalHtg,
        fieldValues: { ...fieldValues, amountUsd: (q.amount / 100).toFixed(2), feeUsd: (q.fee / 100).toFixed(2), rate: String(q.rate) },
      };
    }
    const unitHtg = v.salePriceHtg ?? v.priceHtg;
    return {
      variantId: v.id,
      productName: v.product.name as Prisma.InputJsonValue,
      variantName: v.name as Prisma.InputJsonValue,
      quantity: item.quantity,
      unitPrice: priceIn(unitHtg, currency, settings.htgPerUsd),
      unitHtg,
      fieldValues,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const totalHtg = lines.reduce((s, l) => s + l.unitHtg * l.quantity, 0);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  if (user.status !== "ACTIVE") throw new OrderError("account_restricted");

  const order = await prisma.$transaction(async (tx) => {
    await assertWithinNewAccountLimit(tx, user, totalHtg, settings);
    const created = await tx.order.create({
      data: {
        userId: input.userId,
        currency,
        subtotal,
        total: subtotal,
        rateUsed: currency === "USD" ? new Prisma.Decimal(settings.htgPerUsd) : null,
        paymentMethod: input.method,
        manualMethodId: input.method === "MANUAL" ? input.manualMethodId : null,
        recipientNote: input.recipientNote?.slice(0, 300) || null,
        accessToken: randomToken(),
        items: {
          create: lines.map(({ unitHtg: _u, ...l }) => ({ ...l, fieldValues: l.fieldValues as Prisma.InputJsonValue })),
        },
      },
    });
    await addEvent(tx, created.id, "AWAITING_PAYMENT", `Payment method: ${input.method}`);

    if (totalHtg >= settings.reviewOrderThresholdHtg) {
      await flag(tx, "High-value order: review before release", { userId: input.userId, orderId: created.id });
    }

    if (input.method === "WALLET") {
      await chargeOrder(tx, created);
      await tx.order.update({ where: { id: created.id }, data: { status: "PAID", paidAt: new Date() } });
      await addEvent(tx, created.id, "PAID", "Paid from wallet");
    }
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

  if (input.method === "WALLET") {
    await notify(order.userId, "order_paid", { number: order.number }, `/account/orders/${order.id}`);
    await fulfillOrder(order.id);
  }
  return order;
}

/**
 * Deliver what can be delivered automatically. Code-inventory items get codes assigned, supplier items
 * (options linked to a supplier in Admin) are sent to the supplier; manual items wait in the staff queue.
 * Orders with an open risk flag wait for review.
 */
export async function fulfillOrder(orderId: string, actorId?: string | null): Promise<{ fulfilled: boolean } | null> {
  const openFlags = await prisma.riskFlag.count({ where: { orderId, status: "OPEN" } });

  const result = await prisma.$transaction(async (tx) => {
    const [order] = await tx.$queryRaw<{ id: string; status: OrderStatus }[]>`
      SELECT id, status FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    if (!order || !["PAID", "PROCESSING"].includes(order.status)) return null;

    if (openFlags > 0) {
      if (order.status === "PAID") {
        await tx.order.update({ where: { id: orderId }, data: { status: "PROCESSING" } });
        await addEvent(tx, orderId, "PROCESSING", "Held for review");
      }
      return { fulfilled: false };
    }

    await queueSupplierLines(tx, orderId);
    const items = await tx.orderItem.findMany({ where: { orderId, status: "PENDING" }, include: { variant: { include: { product: true } } } });
    for (const item of items) {
      if (item.variant.product.fulfillmentType !== "CODE_INVENTORY") continue;
      const codes = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "CodeItem" WHERE "variantId" = ${item.variantId} AND status = 'AVAILABLE'
        ORDER BY "createdAt" LIMIT ${item.quantity} FOR UPDATE SKIP LOCKED`;
      if (codes.length < item.quantity) continue; // stays pending; staff restocks or fulfills manually
      // Each code row holds a single orderItemId and is locked above, so it can never go to two orders.
      for (const c of codes) {
        await tx.codeItem.update({
          where: { id: c.id },
          data: { status: "ASSIGNED", assignedAt: new Date(), orderItemId: item.id },
        });
      }
      await tx.orderItem.update({ where: { id: item.id }, data: { status: "DELIVERED" } });
    }

    const remaining = await tx.orderItem.count({ where: { orderId, status: "PENDING" } });
    if (remaining === 0) {
      await tx.order.update({ where: { id: orderId }, data: { status: "FULFILLED", fulfilledAt: new Date() } });
      await addEvent(tx, orderId, "FULFILLED", undefined, actorId);
      return { fulfilled: true };
    }
    if (order.status === "PAID") {
      await tx.order.update({ where: { id: orderId }, data: { status: "PROCESSING" } });
      const toSupplier = await tx.supplierOrder.count({ where: { orderItem: { orderId }, status: "QUEUED" } });
      await addEvent(tx, orderId, "PROCESSING", toSupplier ? "Sent to the supplier" : "Waiting for manual fulfillment");
    }
    return { fulfilled: false };
  });

  // Supplier lines are sent after the transaction (network calls never hold database locks).
  if (result && !result.fulfilled) {
    const delivered = await sendQueued(orderId).catch((e) => (console.error("supplier send failed", orderId, e), []));
    if (delivered.length) return fulfillOrder(orderId, actorId);
  }

  if (result?.fulfilled) {
    const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    await notify(o.userId, "order_fulfilled", { number: o.number }, `/account/orders/${o.id}`);
    await maybeRewardReferral(o.userId).catch((e) => console.error("referral reward failed", e));
  }
  return result;
}

/** Staff marks a manual item delivered with a note shown to the customer. */
export async function deliverItemManually(itemId: string, note: string, actorId: string) {
  const item = await prisma.orderItem.update({ where: { id: itemId }, data: { status: "DELIVERED", deliveryNote: note.slice(0, 2000) } });
  return fulfillOrder(item.orderId, actorId);
}

/** Cancel/refund: a paid order is refunded to the wallet; an unpaid one is canceled. */
export async function refundOrCancel(orderId: string, actorId: string | null, reason: string) {
  const outcome = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (["AWAITING_PAYMENT", "PAYMENT_REVIEW"].includes(order.status)) {
      await tx.order.update({ where: { id: orderId }, data: { status: "CANCELED" } });
      await addEvent(tx, orderId, "CANCELED", reason, actorId);
      return "canceled" as const;
    }
    if (!["PAID", "PROCESSING", "FAILED"].includes(order.status)) throw new OrderError("not_refundable");
    // A supplier may still deliver: refunding now could give the customer both. Staff closes it first.
    if (await hasOpenSupplierOrder(orderId, tx)) throw new OrderError("supplier_open");
    // Delivered codes cannot be taken back; only refund when nothing was delivered.
    const delivered = await tx.orderItem.count({ where: { orderId, status: "DELIVERED" } });
    if (delivered > 0) throw new OrderError("partially_delivered");
    await refundOrder(tx, order, actorId, reason);
    await tx.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } });
    await addEvent(tx, orderId, "REFUNDED", reason, actorId);
    return "refunded" as const;
  });
  if (outcome === "refunded") {
    const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    await notify(o.userId, "order_refunded", { number: o.number }, `/account/orders/${o.id}`);
  }
  return outcome;
}

/** Codes are only decrypted for the order owner (or staff with codes.reveal) and every reveal is audited by the caller. */
export function revealCode(encrypted: string) {
  return decrypt(encrypted);
}

export function itemTitle(item: { productName: unknown; variantName: unknown }, locale: string) {
  return `${t(item.productName, locale)} — ${t(item.variantName, locale)}`;
}
