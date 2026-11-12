"use client";
import { useRef, useState, useTransition } from "react";
import { newRequestId, safeCall } from "@/lib/safe-call";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { placePackOrder } from "@/actions/service-order";
import { formatMoney } from "@/lib/money";
import { withDiscount } from "@/lib/vip-math";
import { splitEvenly } from "@/lib/pack-math";
import { checkLink, PLATFORMS } from "@/lib/services";

type Line = { name: string; quantity: number; post: boolean; min: number; avg: string };

/**
 * Starter pack order: one profile link (followers) and the videos for likes and views, one link per line.
 * The likes/views are spread evenly; each video's share must stay above the provider's minimum (maxVideos).
 */
export function PackOrderForm(p: {
  slug: string; signedIn: boolean; balance: number | null; discount: number; price: number; separate: number; discountPct: number;
  newOnly: boolean; maxVideos: number; platform: string; high: boolean; available: boolean; profileExample: string; videoExample: string; lines: Line[];
}) {
  const t = useTranslations("packUi");
  const tl = useTranslations("orderForm");
  const locale = useLocale();
  const router = useRouter();
  const [profile, setProfile] = useState("");
  const [videos, setVideos] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const requestId = useRef(newRequestId());
  const fmt = (n: number) => formatMoney(n, "HTG", locale);
  const needsProfile = p.lines.some((l) => !l.post);
  const needsVideos = p.lines.some((l) => l.post);
  const list = [...new Set(videos.split("\n").map((x) => x.trim()).filter(Boolean))];
  const tooMany = list.length > p.maxVideos;
  const total = withDiscount(p.price, p.discount);
  const short = p.balance !== null && total > p.balance;
  // Each link is checked as soon as it is typed, with the same checker as single orders.
  const linkMsg = (error: string, post: boolean) => tl(`err_${error === "empty" ? "not_platform" : error}`, { platform: PLATFORMS[p.platform]?.name ?? p.platform, example: post ? p.videoExample : p.profileExample });
  const profileCheck = needsProfile && profile.trim() ? checkLink(profile, p.platform, false) : null;
  const profileError = profileCheck && !profileCheck.ok ? linkMsg(profileCheck.error, false) : "";
  const videoErrors = needsVideos ? list.map((v, i) => { const c = checkLink(v, p.platform, true); return c.ok ? null : t("badVideo", { n: i + 1, error: linkMsg(c.error, true) }); }).filter(Boolean) as string[] : [];
  const missing = [
    needsProfile && (!profile.trim() ? "profile" : profileError && "profileFix"),
    needsVideos && (!list.length ? "videos" : videoErrors.length && "videosFix"),
    !isPublic && "public",
    p.high && !accepted && "risk",
    short && "funds",
  ].filter(Boolean) as string[];
  const ready = p.signedIn && p.available && !tooMany && missing.length === 0;
  const submit = () =>
    start(async () => {
      setError("");
      const r = await safeCall(() => placePackOrder({ requestId: requestId.current, slug: p.slug, profileLink: profile, videoLinks: list.join("\n"), publicOk: isPublic, acceptRisk: accepted }));
      if (r.ok) router.push(`/account/orders/${r.orderId}`);
      else setError(t.has(`error_${r.error}`) ? t(`error_${r.error}`, { max: p.maxVideos }) : t("error_generic"));
    });
  const field = "rounded-xl border border-[#CBD2E1] bg-surface px-3.5 text-base dark:border-border";
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-5 pb-8 pt-4">
      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-muted">{t("price")}</span>
          <span className="text-2xl font-extrabold">{fmt(total)}</span>
        </div>
        <div className="my-1 h-px bg-border" />
        <h2 className="text-[13px] font-bold uppercase tracking-[0.6px] text-muted">{t("inside")}</h2>
        {p.lines.map((l) => (
          <div key={l.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold">{l.name}</span>
            <span className="flex-none font-bold">{l.quantity.toLocaleString("en-US")}</span>
          </div>
        ))}
        <div className="my-1 h-px bg-border" />
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">{t("separately")} <s>{fmt(p.separate)}</s></span>
          <span className="rounded-full bg-[#DCFCE7] px-2.5 py-1 text-xs font-bold text-[#166534]">-{p.discountPct}%</span>
        </div>
        {p.newOnly && <p className="text-xs text-muted">{t("newOnly")}</p>}
      </section>

      {needsProfile && (
        <section className="flex flex-col gap-2">
          <label htmlFor="profile" className="text-sm font-semibold">{t("profileLabel")}</label>
          <input id="profile" value={profile} onChange={(e) => setProfile(e.target.value)} placeholder={p.profileExample} autoComplete="off" autoCapitalize="none" className={`${field} h-[50px] ${profileError ? "border-2 border-[#DC2626]" : ""}`} />
          {profileError && <p role="alert" className="rounded-[10px] bg-[#FEE2E2] px-3 py-2.5 text-[13px] leading-normal text-[#991B1B]">{profileError}</p>}
          <p className="text-xs text-muted">{t("profileHint")}</p>
        </section>
      )}

      {needsVideos && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="videos" className="text-sm font-semibold">{t("videosLabel")}</label>
            <span className={`text-[13px] font-bold ${tooMany ? "text-[#B91C1C]" : ""}`}>{t("videoCount", { n: list.length, max: p.maxVideos })}</span>
          </div>
          <textarea id="videos" rows={4} value={videos} onChange={(e) => setVideos(e.target.value)} placeholder={`${p.videoExample}\n${p.videoExample}`} autoCapitalize="none" className={`${field} py-3 leading-normal ${videoErrors.length ? "border-2 border-[#DC2626]" : ""}`} />
          {videoErrors.length > 0 && <div role="alert" className="flex flex-col gap-1 rounded-[10px] bg-[#FEE2E2] px-3 py-2.5 text-[13px] leading-normal text-[#991B1B]">{videoErrors.slice(0, 3).map((e) => <span key={e}>{e}</span>)}</div>}
          <p className="text-xs text-muted">{t("videosHint", { max: p.maxVideos })}</p>
          {list.length > 0 && !tooMany && (
            <div className="flex flex-col gap-1 rounded-xl bg-surface-2 p-3 text-[13px]">
              <span className="font-bold">{t("split", { n: list.length })}</span>
              {p.lines.filter((l) => l.post).map((l) => {
                const parts = splitEvenly(l.quantity, list.length);
                return <span key={l.name}>{l.name}: {parts[0] === parts[parts.length - 1] ? t("each", { q: parts[0].toLocaleString("en-US") }) : t("eachRange", { a: parts[parts.length - 1].toLocaleString("en-US"), b: parts[0].toLocaleString("en-US") })}</span>;
              })}
            </div>
          )}
        </section>
      )}

      <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-border bg-surface p-3.5 text-[13px] leading-normal">
        <input type="checkbox" checked={isPublic} onChange={() => setIsPublic((v) => !v)} className="m-0 h-[22px] w-[22px] flex-none accent-[#0F172A]" />
        <span>{t("publicConfirm")}</span>
      </label>
      {p.high && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border-2 border-[#FCA5A5] bg-[#FEF2F2] p-3.5 text-[13px] leading-normal text-[#7F1D1D]">
          <input type="checkbox" checked={accepted} onChange={() => setAccepted((a) => !a)} className="m-0 h-[22px] w-[22px] flex-none accent-[#DC2626]" />
          <span>{t("riskAccept")}</span>
        </label>
      )}

      <section className="flex items-baseline justify-between rounded-2xl border border-border bg-surface p-4">
        <span className="text-[15px] font-bold">{t("total")}{p.discount > 0 ? ` (VIP -${p.discount}%)` : ""}</span>
        <span className="text-2xl font-extrabold">{fmt(total)}</span>
      </section>
      {short && <p className="rounded-[10px] bg-[#FEE2E2] px-3 py-2.5 text-[13px] text-[#991B1B]">{t("short")} <Link href="/account/wallet" className="font-bold underline">{t("addFunds")}</Link></p>}
      {!p.available && <p className="rounded-[10px] bg-[#FEF3C7] px-3 py-2.5 text-[13px] text-[#92400E]">{t("unavailable")}</p>}
      {error && <p role="alert" className="rounded-[10px] bg-[#FEE2E2] px-3 py-2.5 text-[13px] text-[#991B1B]">{error}</p>}
      {p.signedIn ? (
        <button type="button" onClick={submit} disabled={!ready || pending}
          className={`flex h-[54px] items-center justify-center rounded-[14px] text-base font-bold ${ready && !pending ? "bg-text text-surface" : "bg-[#CBD5E1] text-[#475569]"}`}>
          {pending ? t("sending") : t("confirm", { total: fmt(total) })}
        </button>
      ) : (
        <Link href={`/auth/register?next=${encodeURIComponent(`/order/pack/${p.slug}`)}`} className="flex h-[54px] items-center justify-center rounded-[14px] bg-text text-base font-bold text-surface">{t("signIn")}</Link>
      )}
      {p.signedIn && p.available && !ready && !pending && missing.length > 0 && (
        <p className="-mt-1 text-center text-[13px] leading-normal text-[#475569] dark:text-muted"><b>{t("needTitle")}</b> {missing.map((m) => t(`need_${m}`)).join(" · ")}</p>
      )}
      <p className="text-center text-xs leading-normal text-muted">{t("autoRefund")}</p>
    </div>
  );
}
