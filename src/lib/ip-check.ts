import "server-only";

/**
 * Is this connection a VPN / proxy / data center, and which country? Uses proxycheck.io (free: 100 checks a day
 * without a key, 1,000 a day with a free key in PROXYCHECK_API_KEY). Answers are kept in memory for an hour.
 * When the service can't be reached the answer is "unknown" (proxy: null) and the trial just gets a few risk points.
 */
const memo = new Map<string, { at: number; v: IpInfo }>();
export type IpInfo = { proxy: boolean | null; country: string | null; type: string | null; provider: string | null };

const PRIVATE = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i;

export async function checkIp(ip: string | null): Promise<IpInfo> {
  const unknown: IpInfo = { proxy: null, country: null, type: null, provider: null };
  if (!ip || PRIVATE.test(ip)) return unknown;
  const hit = memo.get(ip);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.v;
  try {
    const key = process.env.PROXYCHECK_API_KEY ? `&key=${encodeURIComponent(process.env.PROXYCHECK_API_KEY)}` : "";
    const res = await fetch(`https://proxycheck.io/v2/${encodeURIComponent(ip)}?vpn=1&asn=1${key}`, { signal: AbortSignal.timeout(3000) });
    const data = (await res.json()) as Record<string, unknown>;
    const row = data[ip] as { proxy?: string; type?: string; isocode?: string; provider?: string } | undefined;
    if (data.status === "error" || data.status === "denied" || !row) return unknown;
    const v: IpInfo = { proxy: row.proxy === "yes" || /hosting|tor/i.test(row.type ?? ""), country: row.isocode ?? null, type: row.type ?? null, provider: row.provider ?? null };
    memo.set(ip, { at: Date.now(), v });
    if (memo.size > 5000) memo.delete(memo.keys().next().value!);
    return v;
  } catch {
    return unknown;
  }
}
