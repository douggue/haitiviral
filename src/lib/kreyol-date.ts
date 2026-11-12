import { HAITI_TZ } from "./haiti-time";

/**
 * Dates for customers, in Kreyòl or French, Haiti time, 24-hour clock.
 * Browsers and Node have no Kreyòl locale, so Kreyòl months are written here
 * (Intl would fall back to English: "Oct 22, 2026").
 */
const HT_MONTHS = ["jan", "fev", "mas", "avr", "me", "jen", "jiy", "out", "sep", "okt", "nov", "des"];

function parts(d: Date) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: HAITI_TZ, hour12: false, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: n("year"), m: n("month"), d: n("day"), h: n("hour") % 24, min: n("minute") };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "12 nov 2026, 14:05" (ht) or "12 nov. 2026, 14:05" (fr). `time: false` drops the hour. Year left out when it is this year. */
export function kDate(input: Date | string, locale: string, opts: { time?: boolean; year?: boolean } = {}) {
  const date = typeof input === "string" ? new Date(input) : input;
  const x = parts(date);
  const thisYear = parts(new Date()).y === x.y;
  const showYear = opts.year ?? !thisYear;
  let day: string;
  if (locale === "fr") {
    day = new Intl.DateTimeFormat("fr-FR", { timeZone: HAITI_TZ, day: "numeric", month: "short", ...(showYear ? { year: "numeric" } : {}) }).format(date);
  } else {
    day = `${x.d} ${HT_MONTHS[x.m - 1]}${showYear ? ` ${x.y}` : ""}`;
  }
  return opts.time === false ? day : `${day}, ${pad(x.h)}:${pad(x.min)}`;
}

/** Just the hour, "14:05". */
export function kTime(input: Date | string) {
  const x = parts(typeof input === "string" ? new Date(input) : input);
  return `${pad(x.h)}:${pad(x.min)}`;
}

/** "kounye a", "sa gen 3 minit", "sa gen 2 èdtan", "yè, 14:05", then the date. French: "à l'instant", "il y a 3 min", "hier, 14:05". */
export function kAgo(input: Date | string, locale: string, now = new Date()) {
  const date = typeof input === "string" ? new Date(input) : input;
  const s = Math.round((now.getTime() - date.getTime()) / 1000);
  const fr = locale === "fr";
  if (s < 60) return fr ? "à l’instant" : "kounye a";
  const m = Math.floor(s / 60);
  if (m < 60) return fr ? `il y a ${m} min` : `sa gen ${m} minit`;
  const h = Math.floor(m / 60);
  const a = parts(date), b = parts(now);
  const sameDay = a.y === b.y && a.m === b.m && a.d === b.d;
  if (sameDay) return fr ? `il y a ${h} h` : `sa gen ${h} èdtan`;
  const y = parts(new Date(now.getTime() - 86_400_000));
  if (a.y === y.y && a.m === y.m && a.d === y.d) return `${fr ? "hier" : "yè"}, ${kTime(date)}`;
  return kDate(date, locale);
}
