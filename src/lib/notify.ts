import { siteUrl } from "./site-url";
import ht from "@/messages/ht.json";
import fr from "@/messages/fr.json";
import { prisma, type Tx } from "./db";
import { emailEnabled, sendEmail } from "./email";
import { formatMoney } from "./money";
import { sendPush } from "./push";

export type NotificationType =
  | "deposit_approved"
  | "deposit_rejected"
  | "deposit_held"
  | "order_paid"
  | "order_fulfilled"
  | "order_refunded"
  | "order_partial"
  | "exchange_done"
  | "wallet_adjusted"
  | "referral_rewarded"
  | "payout_sent"
  | "payout_rejected"
  | "ticket_reply";

const CATALOGS: Record<string, { notifications: Record<string, string> }> = { ht, fr };

function render(type: string, params: Record<string, string | number>, locale: string) {
  const template = (CATALOGS[locale] ?? ht).notifications[type] ?? ht.notifications[type as keyof typeof ht.notifications] ?? type;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params[k];
    if (k === "amount" && typeof v === "number") return formatMoney(v, (params.currency as "HTG" | "USD") ?? "HTG", locale);
    return v === undefined ? "" : String(v);
  });
}

/**
 * In-app notification, plus a push notification on the devices where the customer turned them on,
 * plus an email when email is configured and the customer keeps email notifications on.
 * WhatsApp delivery plugs in here once a WhatsApp Business account is connected.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  params: Record<string, string | number> = {},
  link?: string,
  db: Tx = prisma,
) {
  if (db === prisma) {
    // Outside a transaction a failed notification must never break the order or payment that triggered it.
    try {
      await prisma.notification.create({ data: { userId, type, params, link } });
    } catch (e) {
      console.error("notification save failed", e);
      return;
    }
  } else {
    await db.notification.create({ data: { userId, type, params, link } });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, locale: true, status: true, notifyPrefs: true } });
    if (!user || user.status === "CLOSED") return;
    const loc = user.locale === "fr" ? "fr" : "ht";
    const text = render(type, params, loc);
    const path = `/${loc}${link ?? "/account/notifications"}`;
    await sendPush(userId, { title: "HaitiViral", body: text, url: path, tag: type });
    const prefs = (user.notifyPrefs ?? {}) as { email?: boolean };
    if (!emailEnabled() || prefs.email === false) return;
    const url = `${siteUrl()}${path}`;
    await sendEmail({
      to: user.email,
      subject: `HaitiViral: ${text.slice(0, 80)}`,
      text: `${text}\n\n${url}`,
      html: `<p style="font-family:Arial,sans-serif;font-size:15px">${text.replace(/[<>&]/g, "")}</p><p><a href="${url}" style="font-family:Arial,sans-serif;color:#1467F5">${url}</a></p>`,
    });
  } catch (e) {
    console.error("notification delivery failed", e);
  }
}
