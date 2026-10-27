import { randomInt } from "node:crypto";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getSettings } from "./settings";
import { checkLink, isShortLink, parseMeta, productKind, wantsPost } from "./services";
import { resolveShortLink } from "./link-resolve";
import { normalizePhone } from "./phone";
import { createFreeOrder } from "./orders";
import { notify } from "./notify";
import { emailEnabled } from "./email";
import { verifyTurnstile } from "./turnstile";
import { linkedAccounts } from "./devices";
import { checkIp } from "./ip-check";
import { isDisposableEmail, scoreTrial, socialHandle, trialDecision } from "./trial-risk";
import { whatsappLink, whatsappVerifyOn } from "./whatsapp";

export class TrialError extends Error {
  constructor(public code: "off" | "first_topup" | "used" | "link" | "phone" | "limit" | "offer" | "captcha" | "email" | "verify_email") {
    super(code);
  }
}

/** The offers that point to an existing service choice. */
export async function trialOffers() {
  const s = await getSettings();
  const products = await prisma.product.findMany({
    where: { slug: { in: s.trialOffers.map((o) => o.product) }, isPublished: true },
    include: { category: true, variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  return s.trialOffers.flatMap((o) => {
    const p = products.find((x) => x.slug === o.product);
    const v = p?.variants[o.tier];
    if (!p || !v || !parseMeta(v.service)) return [];
    return [{ ...o, platform: p.category.slug, variantId: v.id, post: wantsPost(productKind(p.tags), parseMeta(v.service)!.type) }];
  });
}

const ID = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * One free trial per person. Blocked outright: the same account, social account (profile or video link), phone,
 * browser (cookie, or the id kept in local storage + IndexedDB), or another account that shares this browser.
 * Also required: verified email (when email works), no throwaway inbox, the bot check (Turnstile, when on).
 * Then, with WhatsApp on, the customer sends a code from their WhatsApp (that number becomes the trial phone);
 * finally a risk score decides: low → sent at once, middle → staff look, high → refused (src/lib/trial-risk.ts).
 */
export async function requestTrial(
  userId: string,
  input: { offer: string; link: string; phone?: string; localId?: string; fp?: string; captcha?: string },
) {
  const s = await getSettings();
  if (!s.trialEnabled) throw new TrialError("off");
  const offer = (await trialOffers()).find((o) => o.key === input.offer);
  if (!offer) throw new TrialError("offer");

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  if (!(await verifyTurnstile(input.captcha, ip))) throw new TrialError("captcha");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, emailVerified: true } });
  if (isDisposableEmail(user.email)) throw new TrialError("email");
  if (emailEnabled() && !user.emailVerified) throw new TrialError("verify_email");
  if (s.trialStrict) {
    const deposits = await prisma.paymentIntent.count({ where: { userId, orderId: null, status: "SUCCEEDED" } });
    if (deposits === 0) throw new TrialError("first_topup");
  }

  let link = checkLink(input.link, offer.platform, offer.post);
  if (!link.ok) throw new TrialError("link");
  if (isShortLink(link.url, offer.platform)) {
    const full = await resolveShortLink(link.url);
    if (full) link = checkLink(full, offer.platform, offer.post);
    if (!link.ok) throw new TrialError("link");
  }
  const handle = socialHandle(offer.platform, link.url);

  const whatsapp = whatsappVerifyOn();
  const phone = whatsapp ? null : normalizePhone(input.phone);
  if (!whatsapp && !phone) throw new TrialError("phone");

  const deviceId = /(?:^|;\s*)hv_dev=([A-Za-z0-9_-]{16,64})/.exec(h.get("cookie") ?? "")?.[1] ?? null;
  const localId = input.localId && ID.test(input.localId) ? input.localId : null;
  const fingerprint = input.fp && /^[a-f0-9]{32}$/.test(input.fp) ? input.fp : null;

  // A request still waiting for its WhatsApp code can be started over (e.g. to fix the link).
  await prisma.trialRequest.deleteMany({ where: { userId, status: "AWAITING_PHONE" } });

  const linked = (await linkedAccounts(userId)).filter((l) => l.sameDevice).map((l) => l.id);
  const sameBrowser = [
    ...(deviceId ? [{ deviceId }] : []),
    ...(localId ? [{ localId }] : []),
    ...(linked.length ? [{ userId: { in: linked } }] : []),
  ];
  const since = new Date(Date.now() - 86_400_000);
  const [taken, perIp, today] = await Promise.all([
    prisma.trialRequest.findFirst({ where: { OR: [{ userId }, { link: link.url }, ...(handle ? [{ handle }] : []), ...(phone ? [{ phone }] : []), ...sameBrowser] } }),
    ip ? prisma.trialRequest.count({ where: { ip, createdAt: { gte: since } } }) : 0,
    prisma.trialRequest.count({ where: { createdAt: { gte: since } } }),
  ]);
  if (taken) throw new TrialError("used");
  if (perIp >= s.trialPerIpPerDay || today >= s.trialPerDay) throw new TrialError("limit");

  const code = whatsapp ? await freeCode() : null;
  let trial;
  try {
    trial = await prisma.trialRequest.create({
      data: { userId, offer: offer.key, link: link.url, handle, phone, ip, deviceId, localId, fingerprint, code, status: whatsapp ? "AWAITING_PHONE" : "PENDING" },
    });
  } catch {
    throw new TrialError("used"); // unique link / social account / phone / account
  }
  if (whatsapp) return { status: trial.status, code, wa: whatsappLink(code!) };
  const done = await assessTrial(trial.id);
  return { status: done.status, code: null, wa: null };
}

async function freeCode() {
  for (;;) {
    const code = `HV${randomInt(100000, 1000000)}`;
    if (!(await prisma.trialRequest.findUnique({ where: { code } }))) return code;
  }
}

/** Risk score, then: sent at once, left for staff, or refused. */
export async function assessTrial(id: string) {
  const s = await getSettings();
  const t = await prisma.trialRequest.findUniqueOrThrow({ where: { id }, include: { user: { select: { createdAt: true } } } });
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const [ipInfo, sameFingerprint, sameIp, linked, deposits] = await Promise.all([
    checkIp(t.ip),
    t.fingerprint ? prisma.trialRequest.count({ where: { fingerprint: t.fingerprint, NOT: { id } } }) : 0,
    t.ip ? prisma.trialRequest.count({ where: { ip: t.ip, createdAt: { gte: monthAgo }, NOT: { id } } }) : 0,
    linkedAccounts(t.userId),
    prisma.paymentIntent.count({ where: { userId: t.userId, orderId: null, status: "SUCCEEDED" } }),
  ]);
  const { score, reasons } = scoreTrial({
    proxy: ipInfo.proxy, country: ipInfo.country, accountAgeMinutes: (Date.now() - t.user.createdAt.getTime()) / 60_000,
    sameFingerprint: sameFingerprint > 0, sameIp: sameIp > 0, sharedBrowser: linked.some((l) => l.sameDevice), hasDeposit: deposits > 0,
  });
  let decision = trialDecision(score, { autoBelow: s.trialAutoBelow, refuseAt: s.trialRefuseAt });
  if (decision === "approve") {
    const autoToday = await prisma.trialRequest.count({ where: { auto: true, status: "APPROVED", decidedAt: { gte: new Date(Date.now() - 86_400_000) } } });
    if (!s.trialAutoApprove || autoToday >= s.trialAutoPerDay) decision = "review";
  }
  await prisma.trialRequest.update({ where: { id }, data: { risk: score, reasons: reasons as Prisma.InputJsonValue, ipInfo: ipInfo as Prisma.InputJsonValue } });
  if (decision === "approve") return decideTrial(id, true, null, "Low risk: sent automatically", true);
  if (decision === "refuse") return decideTrial(id, false, null, `High risk (${score} points)`, true);
  return prisma.trialRequest.findUniqueOrThrow({ where: { id } });
}

/** WhatsApp webhook: the code came from this number. Returns what to answer in WhatsApp. */
export async function confirmTrialPhone(code: string, fromDigits: string): Promise<"ok" | "review" | "refused" | "used" | "unknown"> {
  const t = await prisma.trialRequest.findUnique({ where: { code } });
  if (!t || t.status !== "AWAITING_PHONE") return "unknown";
  const phone = normalizePhone(`+${fromDigits}`);
  if (!phone) return "unknown";
  try {
    await prisma.trialRequest.update({ where: { id: t.id }, data: { phone, phoneVerifiedAt: new Date(), code: null, status: "PENDING" } });
  } catch {
    await prisma.trialRequest.update({ where: { id: t.id }, data: { code: null, status: "REJECTED", auto: true, decidedAt: new Date(), note: `Phone ${phone} already used for a trial` } });
    return "used";
  }
  const done = await assessTrial(t.id);
  return done.status === "APPROVED" ? "ok" : done.status === "REJECTED" ? "refused" : "review";
}

/** Cron: requests that never got their WhatsApp code within a day are removed (their link can be used again). */
export async function expireTrialCodes() {
  const r = await prisma.trialRequest.deleteMany({ where: { status: "AWAITING_PHONE", createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
  return r.count;
}

/** Approving creates the free order and tells the customer. actorId null = the automatic check. */
export async function decideTrial(id: string, approve: boolean, actorId: string | null, note?: string, auto = false) {
  const trial = await prisma.trialRequest.findUniqueOrThrow({ where: { id } });
  if (trial.status !== "PENDING") return trial;
  const claim = await prisma.trialRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: approve ? "APPROVED" : "REJECTED", decidedAt: new Date(), auto, note: note ?? null } });
  if (claim.count !== 1) return prisma.trialRequest.findUniqueOrThrow({ where: { id } });
  if (!approve) return prisma.trialRequest.findUniqueOrThrow({ where: { id } });
  const offer = (await trialOffers()).find((o) => o.key === trial.offer);
  if (!offer) {
    await prisma.trialRequest.update({ where: { id }, data: { status: "PENDING", decidedAt: null, auto: false, note: "Offer no longer available" } });
    throw new TrialError("offer");
  }
  const order = await createFreeOrder({ userId: trial.userId, variantId: offer.variantId, quantity: offer.quantity, link: trial.link, note: auto ? "Free trial (automatic)" : "Free trial", actorId });
  await notify(trial.userId, "order_paid", { number: order.number }, `/account/orders/${order.id}`);
  return prisma.trialRequest.update({ where: { id }, data: { orderId: order.id } });
}
