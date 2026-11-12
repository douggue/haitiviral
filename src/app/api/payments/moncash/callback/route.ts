import { NextResponse, type NextRequest } from "next/server";
import { retrieveByTransaction } from "@/lib/payments/moncash";
import { verifyMoncashIntent } from "@/lib/payments/verify";

/**
 * MonCash alert/notification URL. The payload is only used to find the transaction;
 * status and amount always come from MonCash's own API, so a forged callback cannot credit anything.
 */
// At most 20 calls a minute per address: each one can make a request to MonCash.
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.delete(hits.keys().next().value!);
  return list.length > 20;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (tooMany(ip)) return NextResponse.json({ ok: false }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const transactionId = String(body.transactionId ?? body.transaction_id ?? "");
  let ref = String(body.reference ?? body.orderId ?? "");
  if (!ref && transactionId) ref = (await retrieveByTransaction(transactionId))?.reference ?? "";
  if (!ref || !/^[a-z0-9]{20,40}$/i.test(ref)) return NextResponse.json({ ok: false }, { status: 400 });
  const r = await verifyMoncashIntent(ref);
  return NextResponse.json({ ok: true, status: r.status });
}
