"use client";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { placeServiceOrder } from "@/actions/service-order";
import { formatMoney } from "@/lib/money";
import {
  checkLink, DRIP_INTERVAL_MIN, DRIP_RUNS, LIVE_DURATIONS, linkExample, parseComments, servicePrice, wantsPost,
  type Kind, type Risk, type ServiceMeta,
} from "@/lib/services";

export type OrderCatalog = {
  slug: string;
  name: string;
  letter: string;
  color: string;
  image: string | null;
  services: { kind: Kind; tiers: { id: string; name: string; rate: number; soldOut: boolean; meta: ServiceMeta }[] }[];
}[];

const RISK_COLOR: Record<Risk, string> = { low: "#16A34A", med: "#D97706", high: "#DC2626" };
const num = (n: number) => n.toLocaleString("en-US");

/** Rounded chip: dark when selected (mockup "pill"). */
const pill = (on: boolean) =>
  `min-h-11 rounded-full border px-3.5 text-sm font-bold transition-colors ${on ? "border-text bg-text text-surface" : "border-[#CBD2E1] bg-surface text-text dark:border-border"}`;

export function OrderForm({ catalog, balance, signedIn, initial }: {
  catalog: OrderCatalog;
  balance: number | null;
  signedIn: boolean;
  initial: { platform?: string; kind?: string; tier?: number };
}) {
  const t = useTranslations("orderForm");
  const locale = useLocale();
  const router = useRouter();
  const [platformSlug, setPlatformSlug] = useState(catalog.find((c) => c.slug === initial.platform)?.slug ?? catalog[0]?.slug ?? "");
  const platform = catalog.find((c) => c.slug === platformSlug) ?? catalog[0];
  const [kindPick, setKindPick] = useState<string | undefined>(initial.kind);
  const service = platform?.services.find((s) => s.kind === kindPick) ?? platform?.services[0];
  const [tierPick, setTierPick] = useState(initial.tier ?? 1);
  const tier = service?.tiers[Math.min(tierPick, (service?.tiers.length ?? 1) - 1)];

  const [link, setLink] = useState("");
  const [qty, setQty] = useState("1000");
  const [dur, setDur] = useState(30);
  const [drip, setDrip] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [comments, setComments] = useState("");
  const [username, setUsername] = useState("");
  const [sheet, setSheet] = useState<null | "drip" | "risk" | "detail">(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!platform || !service || !tier) {
    return <div className="container-page py-16 text-center text-muted">{t("empty")}</div>;
  }
  const meta = tier.meta;
  const hasComments = meta.type === "comments" || meta.type === "liveComments";
  const isLive = meta.type === "live";
  const liveAny = isLive || meta.type === "liveComments";
  const post = wantsPost(service.kind, meta.type);
  const commentList = parseComments(comments);
  const quantity = hasComments ? commentList.length : Number(qty) || 0;
  const total = servicePrice(tier.rate, quantity, meta.type, dur);
  const check = link.trim() ? checkLink(link, platform.slug, post) : null;
  const linkError = check && !check.ok ? t(`err_${check.error === "empty" ? "not_platform" : check.error}`, { platform: platform.name, example: linkExample(platform.slug, post) }) : "";
  const linkOk = check?.ok ? (liveAny ? t("okLive") : post ? t("okPost") : t("okProfile")) : "";
  const rangeError = hasComments
    ? quantity < meta.min ? t("minComments", { min: meta.min }) : quantity > meta.max ? t("range", { min: num(meta.min), max: num(meta.max) }) : ""
    : quantity < meta.min || quantity > meta.max ? t("range", { min: num(meta.min), max: num(meta.max) }) : "";
  const short = balance !== null && total > balance;
  const isHigh = meta.risk === "high";
  const ready = signedIn && check?.ok && !rangeError && !short && (!isHigh || accepted) && (meta.type !== "commentLikes" || username.trim().length > 0) && !tier.soldOut;
  const chips = meta.min >= 500 ? [1000, 5000, 10000, 50000] : [100, 500, 1000, 5000];
  const fmt = (n: number) => formatMoney(n, "HTG", locale);
  const priceLabel = hasComments ? `G ${(tier.rate / 100 / 1000).toFixed(2)}` : fmt(tier.rate);
  const durLabel = (m: number) => (m >= 60 ? t("hours", { n: m / 60 }) : t("minutes", { n: m }));

  const pickTier = (i: number) => {
    setTierPick(i);
    setAccepted(false);
  };
  const submit = () => {
    setError("");
    start(async () => {
      const r = await placeServiceOrder({
        variantId: tier.id,
        link,
        quantity,
        comments: hasComments ? comments : undefined,
        username: meta.type === "commentLikes" ? username : undefined,
        durationMin: isLive ? dur : undefined,
        drip: meta.drip && drip,
        acceptRisk: accepted,
      });
      if (r.ok) router.push(`/account/orders/${r.orderId}`);
      else setError(t.has(`error_${r.error}`) ? t(`error_${r.error}`) : t("error_generic"));
    });
  };
  const sheets = {
    drip: { title: t("dripSheetTitle"), text: t("dripSheetText"), example: t("dripSheetExample") },
    risk: { title: t("riskSheetTitle"), text: t("riskSheetText"), example: t("riskSheetExample") },
    detail: {
      title: `${platform.name} ${t(`kind_${service.kind}`)}: ${tier.name}`,
      text: [t("detailAvg", { time: meta.avg[locale] ?? "" }), t("detailRefill", { value: meta.refillDays ? `${meta.refillDays}` : t("no") }), t("detailLimits", { min: num(meta.min), max: num(meta.max) }), t(`risk_${meta.risk}`)].join("\n"),
      example: meta.desc ? t("detailProvider", { desc: meta.desc }) : "",
    },
  };
  const info = sheet ? sheets[sheet] : null;

  return (
    <div className="relative mx-auto w-full max-w-[560px] bg-bg pb-7">
      <div className="flex flex-col gap-[18px] px-5 pt-4">
        {/* 1 · Platform and service kind */}
        <section className="flex flex-col gap-2.5">
          <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
            {catalog.map((p) => {
              const on = p.slug === platform.slug;
              return (
                <button key={p.slug} type="button" aria-pressed={on} className={`${pill(on)} flex flex-none items-center gap-1.5 pl-1.5 pr-3`}
                  onClick={() => { setPlatformSlug(p.slug); setTierPick(1); setAccepted(false); }}>
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="h-[26px] w-[26px] rounded-lg object-cover" />
                  ) : (
                    <span className="grid h-[26px] w-[26px] place-items-center rounded-lg text-[10px] font-extrabold text-white" style={{ background: p.color }}>{p.letter}</span>
                  )}
                  {p.name}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {platform.services.map((s) => {
              const on = s.kind === service.kind;
              return (
                <button key={s.kind} type="button" aria-pressed={on} onClick={() => { setKindPick(s.kind); setTierPick(1); setAccepted(false); }}
                  className={`min-h-[38px] rounded-[10px] border-2 px-3.5 text-[13px] font-bold ${on ? "border-text bg-primary-soft text-text" : "border-border bg-surface text-text/80"}`}>
                  {t(`kind_${s.kind}`)}
                </button>
              );
            })}
          </div>
        </section>

        {/* 2 · Three choices */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.6px] text-muted">{t("chooseQuality")}</h2>
            <button type="button" onClick={() => setSheet("risk")} className="min-h-9 px-1 text-xs font-bold text-[#00209F] dark:text-primary">{t("whatRisk")}</button>
          </div>
          {service.tiers.map((x, i) => {
            const on = x.id === tier.id;
            const per = x.meta.type === "comments" || x.meta.type === "liveComments" ? t("perComment") : x.meta.type === "live" ? t("per1000live") : t("per1000");
            const price = x.meta.type === "comments" || x.meta.type === "liveComments" ? `G ${(x.rate / 100 / 1000).toFixed(2)}` : fmt(x.rate);
            return (
              <div key={x.id} className={`flex items-stretch rounded-[14px] border-2 bg-surface ${on ? "border-text shadow-[0_0_0_3px_#E2E8F0] dark:shadow-none" : "border-border"} ${x.soldOut ? "opacity-50" : ""}`}>
                <button type="button" aria-pressed={on} disabled={x.soldOut} onClick={() => pickTier(i)} className="flex min-w-0 flex-1 flex-col gap-1.5 py-3 pl-3.5 text-left">
                  <span className="flex items-center gap-2">
                    <span className="text-[15px] font-extrabold">{x.name}</span>
                    <span aria-hidden className="h-[9px] w-[9px] rounded-full" style={{ background: RISK_COLOR[x.meta.risk] }} />
                    <span className="text-xs text-muted">{t(`risk_${x.meta.risk}`)}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {t("avg", { time: x.meta.avg[locale] ?? "" })}
                    {x.meta.refillDays ? ` · ${t("refill", { days: x.meta.refillDays })}` : ""}
                  </span>
                </button>
                <button type="button" onClick={() => pickTier(i)} tabIndex={-1} aria-hidden className="flex flex-col items-end justify-center gap-0.5 pl-2 pr-1">
                  <span className="whitespace-nowrap text-[15px] font-extrabold">{price}</span>
                  <span className="whitespace-nowrap text-[11px] text-muted">{per}</span>
                </button>
                <button type="button" onClick={() => { pickTier(i); setSheet("detail"); }} aria-label={t("details", { name: x.name })} className="grid w-11 flex-none place-items-center text-[#64748B]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                </button>
              </div>
            );
          })}
        </section>

        {/* 3 · Details */}
        <section className="flex flex-col gap-2.5">
          <label htmlFor="link" className="text-sm font-semibold">{liveAny ? t("linkLive") : post ? t("linkPost") : t("linkProfile")}</label>
          <input id="link" type="url" inputMode="url" autoComplete="off" value={link} onChange={(e) => setLink(e.target.value)} placeholder={linkExample(platform.slug, post)}
            className={`h-[50px] rounded-xl bg-surface px-3.5 text-base ${linkError ? "border-2 border-[#DC2626]" : linkOk ? "border-2 border-[#16A34A]" : "border border-[#CBD2E1] dark:border-border"}`} />
          {linkError && <p role="alert" className="rounded-[10px] bg-[#FEE2E2] px-3 py-2.5 text-[13px] leading-normal text-[#991B1B]">{linkError}</p>}
          {linkOk && <p className="rounded-[10px] bg-[#DCFCE7] px-3 py-2.5 text-[13px] text-[#166534]">{linkOk}</p>}

          {!hasComments && (
            <>
              <label htmlFor="qty" className="mt-1 text-sm font-semibold">{t("quantity")}</label>
              <input id="qty" type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)}
                className="h-[50px] rounded-xl border border-[#CBD2E1] bg-surface px-3.5 text-base dark:border-border" />
              <div className="grid grid-cols-4 gap-2">
                {chips.map((n) => (
                  <button key={n} type="button" onClick={() => setQty(String(n))} className={`${pill(quantity === n)} px-0`}>{n >= 1000 ? `${n / 1000}k` : n}</button>
                ))}
              </div>
            </>
          )}

          {isLive && (
            <>
              <div className="mt-1 text-sm font-semibold">{t("howLong")}</div>
              <div className="grid grid-cols-4 gap-2">
                {LIVE_DURATIONS.map((m) => (
                  <button key={m} type="button" onClick={() => setDur(m)} className={`${pill(dur === m)} px-0`}>{m >= 60 ? t("hours", { n: m / 60 }) : t("minutes", { n: m })}</button>
                ))}
              </div>
            </>
          )}

          {hasComments && (
            <>
              <div className="mt-1 flex items-center justify-between">
                <label htmlFor="comments" className="text-sm font-semibold">{t("commentsLabel")}</label>
                <span className="text-[13px] font-bold">{t("commentsCount", { n: commentList.length })}</span>
              </div>
              <textarea id="comments" rows={5} value={comments} onChange={(e) => setComments(e.target.value)}
                className="rounded-xl border border-[#CBD2E1] bg-surface px-3.5 py-3 text-base leading-normal dark:border-border" />
              {commentList.length === 1 && commentList[0].includes(",") && (
                <button type="button" onClick={() => setComments(commentList[0].split(",").map((s) => s.trim()).filter(Boolean).join("\n"))}
                  className="min-h-11 rounded-xl border border-[#F59E0B] bg-[#FFFBEB] text-[13px] font-bold text-[#92400E]">{t("splitCommas")}</button>
              )}
              <div className="flex flex-wrap gap-1.5">
                {t("presets").split("|").map((p) => (
                  <button key={p} type="button" onClick={() => setComments((c) => (c.trim() ? `${c.replace(/\s+$/, "")}\n` : "") + p)}
                    className="min-h-[38px] rounded-full border border-dashed border-[#94A3B8] bg-surface px-3 text-[13px] font-semibold">+ {p}</button>
                ))}
              </div>
            </>
          )}

          {meta.type === "commentLikes" && (
            <>
              <label htmlFor="uname" className="mt-1 text-sm font-semibold">{t("commentAuthor")}</label>
              <input id="uname" type="text" autoCapitalize="none" autoCorrect="off" placeholder="@non" value={username} onChange={(e) => setUsername(e.target.value)}
                className="h-[50px] rounded-xl border border-[#CBD2E1] bg-surface px-3.5 text-base dark:border-border" />
            </>
          )}

          {liveAny && (
            <div className="flex gap-2.5 rounded-xl bg-[#FFEDD5] p-3 text-[13px] leading-normal text-[#7C2D12]">
              <span className="flex h-[22px] flex-none items-center rounded-md bg-[#DC2626] px-2 text-[11px] font-extrabold text-white">LIVE</span>
              <span>{t("liveWarn")}</span>
            </div>
          )}

          {meta.drip && (
            <div className="mt-1 flex items-center gap-2 rounded-[14px] border border-border bg-surface py-1.5 pl-3.5 pr-1.5">
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-bold">{t("dripTitle")}</span>
                <span className="text-xs text-muted">{drip ? t("dripOn", { runs: DRIP_RUNS, minutes: DRIP_INTERVAL_MIN }) : t("dripOff")}</span>
              </div>
              <button type="button" onClick={() => setSheet("drip")} aria-label={t("dripWhat")} className="h-10 w-10 flex-none rounded-full bg-surface-2 font-extrabold text-text/80">?</button>
              <button type="button" onClick={() => setDrip((d) => !d)} aria-pressed={drip} aria-label={t("dripToggle")} className="grid h-11 w-[60px] flex-none place-items-center">
                <span className={`flex h-7 w-12 rounded-full p-[3px] ${drip ? "justify-end bg-text" : "justify-start bg-[#CBD2E1]"}`}><span className="h-[22px] w-[22px] rounded-full bg-white" /></span>
              </button>
            </div>
          )}
        </section>

        {/* Summary */}
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
          <div className="flex justify-between gap-2.5 text-sm"><span className="text-muted">{t("service")}</span><span className="text-right font-semibold">{`${platform.name} ${t(`kind_${service.kind}`)} · ${tier.name}`}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted">{t("quantity")}</span><span className="font-semibold">{hasComments ? t("commentsCount", { n: quantity }) : `${num(quantity)}${isLive ? ` · ${durLabel(dur)}` : ""}`}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted">{t("avgDelivery")}</span><span className="font-semibold">{meta.avg[locale]}</span></div>
          <div className="my-1 h-px bg-border" />
          <div className="flex items-baseline justify-between"><span className="text-[15px] font-bold">{t("total")}</span><span className="text-2xl font-extrabold">{fmt(total)}</span></div>
          {rangeError && <p className="rounded-[10px] bg-[#FEF3C7] px-3 py-2.5 text-[13px] text-[#92400E]">{rangeError}</p>}
          {short && (
            <p className="rounded-[10px] bg-[#FEE2E2] px-3 py-2.5 text-[13px] text-[#991B1B]">
              {t("short")} <Link href="/account/wallet" className="font-bold text-[#991B1B] underline">{t("addFunds")}</Link>
            </p>
          )}
        </section>

        {isHigh && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border-2 border-[#FCA5A5] bg-[#FEF2F2] p-3.5 text-[13px] leading-normal text-[#7F1D1D]">
            <input type="checkbox" checked={accepted} onChange={() => setAccepted((a) => !a)} className="m-0 h-[22px] w-[22px] flex-none accent-[#DC2626]" />
            <span>{t.rich("riskAccept", { b: (c) => <b>{c}</b> })}</span>
          </label>
        )}

        {error && <p role="alert" className="rounded-[10px] bg-[#FEE2E2] px-3 py-2.5 text-[13px] text-[#991B1B]">{error}</p>}
        {signedIn ? (
          <button type="button" onClick={submit} disabled={!ready || pending}
            className={`flex h-[54px] items-center justify-center rounded-[14px] text-base font-bold ${ready && !pending ? "bg-text text-surface" : "bg-[#CBD5E1] text-[#475569]"}`}>
            {pending ? t("sending") : t("confirm", { total: fmt(total) })}
          </button>
        ) : (
          <Link href={`/auth/login?next=/order`} className="flex h-[54px] items-center justify-center rounded-[14px] bg-text text-base font-bold text-surface">{t("signInToOrder")}</Link>
        )}
        <p className="text-center text-xs leading-normal text-muted">{t("autoRefund")}</p>
      </div>

      {info && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[rgba(15,23,42,0.55)]" onClick={() => setSheet(null)}>
          <div role="dialog" aria-modal="true" aria-label={info.title} onClick={(e) => e.stopPropagation()}
            className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5 rounded-t-[22px] bg-surface px-[22px] pb-[calc(30px+env(safe-area-inset-bottom,0px))] pt-3">
            <div className="h-[5px] w-10 self-center rounded-full bg-[#CBD2E1]" />
            <h2 className="text-lg font-extrabold">{info.title}</h2>
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-text/80">{info.text}</p>
            {info.example && <div className="whitespace-pre-line rounded-xl bg-[#EEF1FF] px-3.5 py-3 text-sm leading-normal text-[#1E3A8A]">{info.example}</div>}
            <button type="button" onClick={() => setSheet(null)} className="h-[50px] rounded-[14px] bg-text text-base font-bold text-surface">{t("gotIt")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
