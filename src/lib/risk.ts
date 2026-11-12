import type { Tx } from "./db";
import type { Settings } from "./settings";
import { haitiDayStart } from "./haiti-time";

/**
 * HTG-equivalent money a user put in today (Haiti day): deposits being checked or credited.
 * Abandoned MonCash attempts don't count, and spending one's own wallet on orders is not counted again.
 */
async function todaysVolumeHtg(tx: Tx, userId: string, htgPerUsd: number) {
  const intents = await tx.paymentIntent.findMany({
    where: { userId, orderId: null, createdAt: { gte: haitiDayStart() }, status: { in: ["REVIEW", "SUCCEEDED"] } },
    select: { amount: true, currency: true },
  });
  return intents.reduce((s, i) => s + (i.currency === "HTG" ? i.amount : Math.round(i.amount * htgPerUsd)), 0);
}

export class LimitExceededError extends Error {}

/**
 * New accounts get a lower daily limit on money coming in (blueprint §8). Orders paid from the wallet use money
 * that was already checked when deposited, so they pass (kind "order").
 */
export async function assertWithinNewAccountLimit(
  tx: Tx,
  user: { id: string; createdAt: Date },
  addHtg: number,
  s: Settings,
  kind: "deposit" | "order" = "order",
) {
  if (kind === "order") return;
  const ageDays = (Date.now() - user.createdAt.getTime()) / 86_400_000;
  if (ageDays >= s.newAccountDays) return;
  const used = await todaysVolumeHtg(tx, user.id, s.htgPerUsd);
  if (used + addHtg > s.newAccountDailyLimitHtg) throw new LimitExceededError("new_account_limit");
}

export async function flag(
  tx: Tx,
  reason: string,
  refs: { userId?: string; orderId?: string; paymentIntentId?: string },
) {
  return tx.riskFlag.create({ data: { reason, ...refs } });
}
