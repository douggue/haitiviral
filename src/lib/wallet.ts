import type { Currency, Order, PaymentIntent } from "@prisma/client";
import type { Tx } from "./db";
import { heldAccount, post, systemAccount, walletAccount } from "./ledger";

/** Credit an approved external payment to the customer's wallet (or held balance). */
export async function creditPayment(tx: Tx, intent: PaymentIntent, opts: { hold: boolean; actorId?: string | null }) {
  const clearing = await systemAccount(tx, "clearing", intent.currency, intent.provider.toLowerCase());
  const target = opts.hold
    ? await heldAccount(tx, intent.userId, intent.currency)
    : await walletAccount(tx, intent.userId, intent.currency);
  return post(tx, {
    type: "DEPOSIT",
    idempotencyKey: `deposit:${intent.id}`,
    description: `${intent.provider} payment ${intent.providerRef ?? intent.id}${opts.hold ? " (held)" : ""}`,
    createdById: opts.actorId,
    metadata: { paymentIntentId: intent.id, held: opts.hold },
    entries: [
      { accountId: clearing.id, currency: intent.currency, amount: -intent.amount },
      { accountId: target.id, currency: intent.currency, amount: intent.amount },
    ],
  });
}

/** Move a held deposit into the spendable wallet. */
export async function releaseHold(tx: Tx, intent: PaymentIntent, actorId?: string | null) {
  const held = await heldAccount(tx, intent.userId, intent.currency);
  const wallet = await walletAccount(tx, intent.userId, intent.currency);
  return post(tx, {
    type: "HOLD_RELEASE",
    idempotencyKey: `release:${intent.id}`,
    description: `Hold released for payment ${intent.id}`,
    createdById: actorId,
    metadata: { paymentIntentId: intent.id },
    entries: [
      { accountId: held.id, currency: intent.currency, amount: -intent.amount },
      { accountId: wallet.id, currency: intent.currency, amount: intent.amount },
    ],
  });
}

/** Debit the wallet for an order. Throws InsufficientFundsError when the balance is too low. */
export async function chargeOrder(tx: Tx, order: Order) {
  const wallet = await walletAccount(tx, order.userId, order.currency);
  const revenue = await systemAccount(tx, "revenue", order.currency);
  return post(tx, {
    type: "PURCHASE",
    idempotencyKey: `order:${order.id}:charge`,
    description: `Order #${order.number}`,
    metadata: { orderId: order.id },
    entries: [
      { accountId: wallet.id, currency: order.currency, amount: -order.total },
      { accountId: revenue.id, currency: order.currency, amount: order.total },
    ],
  });
}

/** What has already gone back to the customer's wallet for this order (full and partial refunds). */
export async function refundedSoFar(tx: Tx, order: Pick<Order, "id" | "userId" | "currency">) {
  const wallet = await walletAccount(tx, order.userId, order.currency);
  const sum = await tx.ledgerEntry.aggregate({
    where: { accountId: wallet.id, amount: { gt: 0 }, transaction: { type: "REFUND", metadata: { path: ["orderId"], equals: order.id } } },
    _sum: { amount: true },
  });
  return sum._sum.amount ?? 0;
}

/**
 * Refund an order back to the customer's wallet in the currency it was charged: only what was not already
 * given back (a pack line or a partial delivery refunded earlier is never paid twice). Nothing to post for 0.
 */
export async function refundOrder(tx: Tx, order: Order, actorId: string | null, reason: string) {
  const amount = order.total - (await refundedSoFar(tx, order));
  if (amount <= 0) return null;
  const wallet = await walletAccount(tx, order.userId, order.currency);
  const revenue = await systemAccount(tx, "revenue", order.currency);
  return post(tx, {
    type: "REFUND",
    idempotencyKey: `order:${order.id}:refund`,
    description: `Refund for order #${order.number}: ${reason}`,
    createdById: actorId,
    metadata: { orderId: order.id, reason },
    entries: [
      { accountId: revenue.id, currency: order.currency, amount: -amount },
      { accountId: wallet.id, currency: order.currency, amount },
    ],
  });
}

/** Give back part of an order (the provider delivered only part of it). Once per order line. */
export async function refundPart(tx: Tx, order: Order, requested: number, lineId: string, reason: string) {
  // Never more than what is left of the order after earlier refunds.
  const amount = Math.min(requested, order.total - (await refundedSoFar(tx, order)));
  if (amount <= 0) return null;
  const wallet = await walletAccount(tx, order.userId, order.currency);
  const revenue = await systemAccount(tx, "revenue", order.currency);
  return post(tx, {
    type: "REFUND",
    idempotencyKey: `order:${order.id}:partial:${lineId}`,
    description: `Partial refund for order #${order.number}: ${reason}`,
    metadata: { orderId: order.id, lineId, reason },
    entries: [
      { accountId: revenue.id, currency: order.currency, amount: -amount },
      { accountId: wallet.id, currency: order.currency, amount },
    ],
  });
}

export async function postExchange(
  tx: Tx,
  q: { id: string; userId: string; fromCurrency: Currency; toCurrency: Currency; fromAmount: number; toAmount: number },
) {
  const fromWallet = await walletAccount(tx, q.userId, q.fromCurrency);
  const toWallet = await walletAccount(tx, q.userId, q.toCurrency);
  const fxFrom = await systemAccount(tx, "fx", q.fromCurrency);
  const fxTo = await systemAccount(tx, "fx", q.toCurrency);
  return post(tx, {
    type: "EXCHANGE",
    idempotencyKey: `exchange:${q.id}`,
    description: `Exchange ${q.fromCurrency} → ${q.toCurrency}`,
    metadata: { quoteId: q.id },
    entries: [
      { accountId: fromWallet.id, currency: q.fromCurrency, amount: -q.fromAmount },
      { accountId: fxFrom.id, currency: q.fromCurrency, amount: q.fromAmount },
      { accountId: fxTo.id, currency: q.toCurrency, amount: -q.toAmount },
      { accountId: toWallet.id, currency: q.toCurrency, amount: q.toAmount },
    ],
  });
}

/**
 * Crypto deposits arrive in USD, but everything on the site is priced in HTG: once spendable, the USD is changed
 * to HTG at the day's rate (Admin → Pricing), so the money is never stuck in a wallet nothing can be bought with.
 */
export async function usdDepositToHtg(tx: Tx, intent: PaymentIntent, htgPerUsd: number) {
  if (intent.currency !== "USD" || intent.orderId) return null;
  return postExchange(tx, { id: `deposit-${intent.id}`, userId: intent.userId, fromCurrency: "USD", toCurrency: "HTG", fromAmount: intent.amount, toAmount: Math.round(intent.amount * htgPerUsd) });
}

/** Staff correction with a reason; positive credits the customer, negative debits. */
export async function adjustWallet(
  tx: Tx,
  a: { userId: string; currency: Currency; amount: number; reason: string; actorId: string; idempotencyKey: string },
) {
  const wallet = await walletAccount(tx, a.userId, a.currency);
  const adj = await systemAccount(tx, "adjustment", a.currency);
  return post(tx, {
    type: "ADJUSTMENT",
    idempotencyKey: `adjust:${a.idempotencyKey}`,
    description: `Adjustment: ${a.reason}`,
    createdById: a.actorId,
    metadata: { reason: a.reason },
    entries: [
      { accountId: adj.id, currency: a.currency, amount: -a.amount },
      { accountId: wallet.id, currency: a.currency, amount: a.amount },
    ],
  });
}

/**
 * Exchange quote math. `htgPerUsd` is the mid rate; the spread moves the rate against the customer.
 * Amounts are minor units on both sides (centimes and cents), so the ratio is unchanged.
 */
export function quoteExchange(
  from: Currency,
  fromAmount: number,
  s: { htgPerUsd: number; exchangeSpreadBps: number; exchangeFeeBps: number },
) {
  const fee = Math.ceil((fromAmount * s.exchangeFeeBps) / 10_000);
  const net = fromAmount - fee;
  // Integer math (micro-HTG per USD) so floating-point error never shaves a cent off the customer.
  const sign = from === "HTG" ? 1 : -1;
  const rateMicro = Math.round((s.htgPerUsd * 1_000_000 * (10_000 + sign * s.exchangeSpreadBps)) / 10_000);
  const rate = rateMicro / 1_000_000;
  if (from === "HTG") return { to: "USD" as Currency, toAmount: Math.floor((net * 1_000_000) / rateMicro), rate, fee };
  return { to: "HTG" as Currency, toAmount: Math.floor((net * rateMicro) / 1_000_000), rate, fee };
}
