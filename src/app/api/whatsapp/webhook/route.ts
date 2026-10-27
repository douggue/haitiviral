import { NextResponse, type NextRequest } from "next/server";
import { confirmTrialPhone } from "@/lib/trials";
import { findCode, incomingTexts, replyText, validSignature, whatsappVerifyOn } from "@/lib/whatsapp";

/** Meta checks the webhook once when it is saved: echo the challenge if the verify token matches. */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (whatsappVerifyOn() && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

const ANSWER: Record<string, string> = {
  ok: "✅ Mèsi! Nimewo w konfime. Esè gratis ou an wout. / Numéro confirmé, votre essai est en route.",
  review: "✅ Mèsi! Nimewo w konfime. Ekip la ap verifye esè w la byento. / Numéro confirmé, l'équipe vérifie votre essai.",
  refused: "Nimewo w konfime, men nou pa ka bay esè sa a. / Numéro confirmé, mais cet essai ne peut pas être accordé.",
  used: "Nimewo sa a deja resevwa yon esè gratis. / Ce numéro a déjà reçu un essai gratuit.",
};

/** Incoming WhatsApp messages: a trial code ("HV123456") confirms the sender's number for that trial. */
export async function POST(req: NextRequest) {
  if (!whatsappVerifyOn()) return new NextResponse("off", { status: 404 });
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new NextResponse("bad signature", { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }
  for (const m of incomingTexts(body)) {
    const code = findCode(m.text);
    if (!code) continue;
    try {
      const r = await confirmTrialPhone(code, m.from);
      if (ANSWER[r]) await replyText(m.from, ANSWER[r]);
    } catch (e) {
      console.error("WhatsApp trial code failed", e);
    }
  }
  // Always 200 so Meta doesn't keep resending.
  return NextResponse.json({ ok: true });
}
