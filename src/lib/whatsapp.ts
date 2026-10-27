import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * WhatsApp phone check for free trials (Meta WhatsApp Cloud API, "the customer sends the code"):
 * the customer taps a button that opens WhatsApp with "HV123456" typed in; Meta forwards the message to
 * /api/whatsapp/webhook and the sender's number becomes the trial's verified phone. Receiving costs nothing.
 *
 * Off until these are set in the hosting environment (never in code):
 *   WHATSAPP_BUSINESS_NUMBER   the number customers write to, digits only (e.g. 50937000000)
 *   WHATSAPP_VERIFY_TOKEN      any long random text, also typed in Meta's webhook settings
 *   WHATSAPP_APP_SECRET        Meta app secret (checks that messages really come from Meta)
 * Optional, to answer "confirmed" in WhatsApp:
 *   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 */
export function whatsappVerifyOn(): boolean {
  return !!process.env.WHATSAPP_BUSINESS_NUMBER && !!process.env.WHATSAPP_VERIFY_TOKEN && !!process.env.WHATSAPP_APP_SECRET;
}

export function whatsappLink(code: string): string {
  const number = (process.env.WHATSAPP_BUSINESS_NUMBER ?? "").replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(`HaitiViral ${code}`)}`;
}

/** Meta signs each delivery with the app secret: header "X-Hub-Signature-256: sha256=<hex>". */
export function validSignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Text messages in a webhook delivery: sender number (digits) and text. */
export function incomingTexts(body: unknown): { from: string; text: string }[] {
  const out: { from: string; text: string }[] = [];
  const entries = (body as { entry?: { changes?: { value?: { messages?: { from?: string; type?: string; text?: { body?: string } }[] } }[] }[] })?.entry ?? [];
  for (const e of entries) for (const c of e.changes ?? []) for (const m of c.value?.messages ?? []) {
    if (m.from && m.type === "text" && m.text?.body) out.push({ from: m.from, text: m.text.body });
  }
  return out;
}

/** "HV123456" (spaces, dash and case don't matter). */
export function findCode(text: string): string | null {
  const m = /\bHV[\s-]?(\d{6})\b/i.exec(text);
  return m ? `HV${m[1]}` : null;
}

/** Answer inside the 24-hour window the customer opened (free-form text is allowed there). Best effort. */
export async function replyText(to: string, text: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;
  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error("WhatsApp reply failed", e);
  }
}
