import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { getSettings } from "./settings";
import { post, systemAccount, walletAccount } from "./ledger";
import { notify } from "./notify";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no look-alike characters

export async function ensureReferralCode(userId: string): Promise<string> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
  if (u.referralCode) return u.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = Array.from(randomBytes(7), (b) => ALPHABET[b % ALPHABET.length]).join("");
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // collision: try another code
    }
  }
  throw new Error("Could not create a referral code");
}

/** Called when a new account is created with a referral cookie. */
export async function recordReferral(referredId: string, code: string | undefined, ip: string | null) {
  if (!code) return;
  const settings = await getSettings();
  if (!settings.referralEnabled) return;
  const referrer = await prisma.user.findUnique({ where: { referralCode: code.toUpperCase() }, select: { id: true, status: true } });
  if (!referrer || referrer.id === referredId || referrer.status !== "ACTIVE") return;
  await prisma.referral.create({ data: { referrerId: referrer.id, referredId, signupIp: ip } }).catch(() => undefined);
}

/**
 * After a referred customer's first order is delivered: pay the referrer in store credit,
 * unless the order is too small or both accounts were used from the same network (self-referral).
 */
export async function maybeRewardReferral(referredId: string) {
  const ref = await prisma.referral.findUnique({ where: { referredId } });
  if (!ref || ref.status !== "PENDING") return;
  const settings = await getSettings();
  if (!settings.referralEnabled) return;
  const order = await prisma.order.findFirst({ where: { userId: referredId, status: "FULFILLED" }, orderBy: { fulfilledAt: "asc" } });
  if (!order) return;
  const totalHtg = order.currency === "HTG" ? order.total : Math.round(order.total * settings.htgPerUsd);
  if (totalHtg < settings.referralMinOrderHtg) return; // wait for a qualifying order

  const referrerIps = (await prisma.session.findMany({ where: { userId: ref.referrerId }, select: { ipAddress: true } })).map((s) => s.ipAddress).filter(Boolean);
  const referredIps = [ref.signupIp, ...(await prisma.session.findMany({ where: { userId: referredId }, select: { ipAddress: true } })).map((s) => s.ipAddress)].filter(Boolean);
  if (referredIps.some((ip) => referrerIps.includes(ip))) {
    await prisma.referral.update({ where: { id: ref.id }, data: { status: "REJECTED", note: "Same network as the referrer" } });
    return;
  }
  await payReferral(ref.id, null);
}

export async function payReferral(referralId: string, actorId: string | null) {
  const settings = await getSettings();
  const amount = settings.referralRewardHtg;
  const ref = await prisma.$transaction(async (tx) => {
    const r = await tx.referral.findUniqueOrThrow({ where: { id: referralId } });
    if (r.status === "REWARDED") return null;
    const wallet = await walletAccount(tx, r.referrerId, "HTG");
    const source = await systemAccount(tx, "adjustment", "HTG", "referral");
    await post(tx, {
      type: "ADJUSTMENT",
      idempotencyKey: `referral:${r.id}`,
      description: "Referral reward",
      createdById: actorId,
      metadata: { referralId: r.id },
      entries: [
        { accountId: source.id, currency: "HTG", amount: -amount },
        { accountId: wallet.id, currency: "HTG", amount },
      ],
    });
    return tx.referral.update({ where: { id: r.id }, data: { status: "REWARDED", rewardAmount: amount, rewardedAt: new Date() } });
  });
  if (ref) await notify(ref.referrerId, "referral_rewarded", { amount, currency: "HTG" }, "/account/referrals");
}
