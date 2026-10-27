"use server";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/session";
import { revealCode } from "@/lib/orders";
import { findSmsCode, parseSmsLine } from "@/lib/accounts";
import { mockSupplierAllowed } from "@/lib/suppliers/mock";

/** Hosts we may open for SMS codes: the accounts provider's own site (and the fake one on test setups). */
function allowed(url: URL) {
  if (url.protocol !== "https:" && !(mockSupplierAllowed() && url.protocol === "http:")) return false;
  if (/(^|\.)ytseller\.com$/i.test(url.hostname)) return true;
  return mockSupplierAllowed() && (url.hostname === "localhost" || url.hostname === "127.0.0.1") && url.pathname.startsWith("/api/suppliers/mock-ytseller");
}

/**
 * Customer: read the latest code for one of their SMS numbers, from the provider's code page, on our server.
 * The provider's link is never shown unless the code can't be read from it.
 */
export async function readSmsCode(codeItemId: string): Promise<{ ok: true; code: string | null; fallback: string | null } | { ok: false }> {
  const user = await assertUser();
  const item = await prisma.codeItem.findFirst({ where: { id: String(codeItemId).slice(0, 40), orderItem: { order: { userId: user.id } } }, select: { codeEncrypted: true } });
  if (!item) return { ok: false };
  const { url } = parseSmsLine(revealCode(item.codeEncrypted));
  if (!url) return { ok: true, code: null, fallback: null };
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: true, code: null, fallback: null };
  }
  if (!allowed(u)) return { ok: true, code: null, fallback: url };
  try {
    const res = await fetch(u, { redirect: "error", signal: AbortSignal.timeout(6000), cache: "no-store" });
    const text = (await res.text()).slice(0, 200_000);
    const code = findSmsCode(text);
    return { ok: true, code, fallback: code ? null : url };
  } catch {
    return { ok: true, code: null, fallback: url };
  }
}
