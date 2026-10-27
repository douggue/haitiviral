import { NextResponse, type NextRequest } from "next/server";
import { mockSupplierAllowed } from "@/lib/suppliers/mock";

/**
 * Fake accounts provider (YTSeller API) for tests and previews: Admin → Providers → "Test accounts provider", key "mock-key".
 * Nothing is stored: the order id holds the product, the time and the quantity; the status follows the clock.
 * 501-502, 504-506: delivered after a few seconds · 503: made on order, ends Partial (one piece missing) · 599: refused.
 * The same trans_id always returns the same order id.
 */
const PRODUCTS = [
  { product: 501, name: "Gmail account | aged 2020 | recovery email", category: "Gmail", rate: 0.45, min: 1, max: 50, type: "manual", status: "In stock", inventory: 320, require: null, description: "Old Gmail with recovery email. Format: email:password:recovery", seconds: 5 },
  { product: 502, name: "Instagram account | 2018 | 100+ followers", category: "Instagram", rate: 1.9, min: 1, max: 10, type: "manual", status: "In stock", inventory: 42, require: null, description: "Aged Instagram with 2FA. Format: login|password|2fa secret", seconds: 5 },
  { product: 503, name: "Facebook account | made on order", category: "Facebook", rate: 2.5, min: 1, max: 5, type: "api", status: "In stock", inventory: null, require: "First name for the profile", description: "Created on order, 24h.", seconds: 20 },
  { product: 504, name: "US number for WhatsApp / Telegram (receive SMS)", category: "SMS", rate: 0.33, min: 1, max: 5, type: "manual", status: "In stock", inventory: 15, require: null, description: "US number, codes on the link.", seconds: 5 },
  { product: 505, name: "TikTok account | 1K followers", category: "TikTok", rate: 6.5, min: 1, max: 3, type: "manual", status: "Out of stock", inventory: 0, require: null, description: "", seconds: 5 },
  { product: 506, name: "Discord account | email verified", category: "Discord", rate: 0.09, min: 1, max: 100, type: "manual", status: "In stock", inventory: 900, require: null, description: "", seconds: 5 },
  { product: 599, name: "Disabled product (always refused)", category: "Test", rate: 1, min: 1, max: 5, type: "manual", status: "In stock", inventory: 5, require: null, description: "", seconds: 1 },
];

function lines(product: number, qty: number, at: number) {
  return Array.from({ length: qty }, (_, i) => {
    const n = `${at}${i}`.slice(-6);
    if (product === 501) return `hv.test${n}@gmail.com:Pw${n}x!:rec${n}@outlook.com`;
    if (product === 502) return `ig_test${n}|Pw${n}x!|JBSWY3DPEHPK3PXP`;
    if (product === 504) return `+1 (305) 555-${n.slice(-4)} | http://localhost:3000/api/suppliers/mock-ytseller?sms=${n}`;
    return `user${n}:Pw${n}x!`;
  });
}

function state(id: string) {
  const [product, at, qty] = id.split(".").map(Number);
  const p = PRODUCTS.find((x) => x.product === product);
  if (!p || !at) return { error: "Incorrect order ID" };
  const done = Date.now() / 1000 - at >= p.seconds;
  if (!done) return { charge: (p.rate * qty).toFixed(2), status: "In progress", remains: qty, currency: "USD" };
  if (product === 503) return { charge: (p.rate * (qty - 1)).toFixed(2), status: "Partial", remains: 1, currency: "USD" };
  return { charge: (p.rate * qty).toFixed(2), status: "Completed", remains: 0, currency: "USD" };
}

/** SMS code page of the fake numbers (what a real "get code" link might show). */
export function GET(req: NextRequest) {
  if (!mockSupplierAllowed()) return new NextResponse("not found", { status: 404 });
  const n = req.nextUrl.searchParams.get("sms") ?? "0";
  return new NextResponse(`<html><body><p>From WhatsApp: Your WhatsApp code: ${n.slice(-3)}-${n.slice(0, 3)}</p><p>Your code is ${n.padStart(6, "4")}</p></body></html>`, { headers: { "content-type": "text/html" } });
}

const seen = new Map<string, string>();

export async function POST(req: NextRequest) {
  if (!mockSupplierAllowed()) return new NextResponse("not found", { status: 404 });
  const f = new URLSearchParams(await req.text());
  if (f.get("key") !== "mock-key") return NextResponse.json({ error: "Invalid API key" });
  switch (f.get("action")) {
    case "products":
      return NextResponse.json(PRODUCTS.map(({ seconds: _s, ...x }) => x));
    case "balance":
      return NextResponse.json({ balance: "68.6868", currency: "USD" });
    case "add_product_order": {
      const trans = f.get("trans_id");
      if (trans && seen.has(trans)) return NextResponse.json({ order: seen.get(trans) });
      const product = Number(f.get("product"));
      const p = PRODUCTS.find((x) => x.product === product);
      if (!p || product === 599) return NextResponse.json({ error: "Product is not available" });
      if (p.inventory === 0) return NextResponse.json({ error: "Out of stock" });
      if (p.require && !f.get("require")) return NextResponse.json({ error: `Missing: ${p.require}` });
      const qty = Number(f.get("quantity"));
      if (!qty || qty < p.min || qty > p.max) return NextResponse.json({ error: `Quantity must be between ${p.min} and ${p.max}` });
      const id = `${product}.${Math.floor(Date.now() / 1000)}.${qty}`;
      if (trans) seen.set(trans, id);
      return NextResponse.json({ order: id });
    }
    case "product_order_status":
      return NextResponse.json(state(f.get("order") ?? ""));
    case "result_product": {
      const [product, at, qty] = (f.get("order") ?? "").split(".").map(Number);
      const s = state(f.get("order") ?? "");
      if ("error" in s) return NextResponse.json(s);
      if (s.status === "In progress") return NextResponse.json({ result: [] });
      return NextResponse.json({ result: lines(product, qty - s.remains, at) });
    }
    default:
      return NextResponse.json({ error: "Incorrect request" });
  }
}
