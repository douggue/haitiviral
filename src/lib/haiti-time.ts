/** Haiti time (America/Port-au-Prince, UTC−5 or −4 in summer), whatever time zone the server runs in. */
export const HAITI_TZ = "America/Port-au-Prince";

/** Minutes Haiti is behind UTC at this moment (300 or 240). */
function offsetMinutes(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: HAITI_TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour") % 24, n("minute"));
  return Math.round((at.getTime() - asUtc) / 60_000);
}

/** Midnight in Haiti at the start of the day `daysAgo` days back (0 = today), as a real instant. */
export function haitiDayStart(daysAgo = 0, now = new Date()) {
  const off = offsetMinutes(now);
  const local = new Date(now.getTime() - off * 60_000); // Haiti wall clock, read as UTC
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - daysAgo);
  return new Date(local.getTime() + offsetMinutes(new Date(local.getTime() + off * 60_000)) * 60_000);
}
