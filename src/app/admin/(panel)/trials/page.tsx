import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { linkedAccounts } from "@/lib/devices";
import { whatsappVerifyOn } from "@/lib/whatsapp";
import { turnstileEnabled } from "@/lib/turnstile";
import { decideTrialAction, saveTrialSettings } from "@/actions/admin";
import { ActionButton, ActionForm } from "@/components/admin/ActionButton";
import { PageTitle, Table } from "@/components/admin/ui";

export const metadata = { title: "Free trials" };

const input = "h-9 w-full rounded-lg border border-[#CBD2E1] bg-surface px-2 text-sm dark:border-border";
const STATUS: Record<string, string> = { AWAITING_PHONE: "WAITING WHATSAPP", PENDING: "TO REVIEW", APPROVED: "SENT", REJECTED: "REFUSED" };

/**
 * Free trial requests. Blocked automatically: same account, phone, link, social account or browser.
 * The rest get a risk score: low is sent at once, middle waits here, high is refused (reasons shown per row).
 */
export default async function TrialsAdmin() {
  await requireStaff("orders.view");
  const [s, list] = await Promise.all([
    getSettings(),
    prisma.trialRequest.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200, include: { user: { select: { id: true, name: true, email: true } } } }),
  ]);
  const review = list.filter((r) => r.status === "PENDING");
  const linked = new Map(await Promise.all(review.map(async (r) => [r.id, (await linkedAccounts(r.userId)).filter((l) => l.sameDevice || l.sameIp)] as const)));
  const offer = (key: string) => s.trialOffers.find((o) => o.key === key)?.label.ht ?? key;
  const tone = (n: number) => (n >= s.trialRefuseAt ? "bg-[#FEE2E2] text-[#991B1B]" : n >= s.trialAutoBelow ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#DCFCE7] text-[#166534]");
  const day = Date.now() - 86_400_000;
  const autoToday = list.filter((r) => r.auto && r.status === "APPROVED" && r.decidedAt && r.decidedAt.getTime() > day).length;
  return (
    <>
      <PageTitle
        title="Free trials"
        sub={`${s.trialEnabled ? "Trials on" : "Trials OFF"} · ${review.length} to review · ${autoToday}/${s.trialAutoPerDay} sent automatically today · WhatsApp check ${whatsappVerifyOn() ? "on" : "off (keys not set)"} · bot check ${turnstileEnabled() ? "on" : "off (keys not set)"}`}
      />
      <Table head={["Customer", "Trial", "Link", "Phone", "Risk", "Status", ""]} empty={list.length === 0}>
        {list.map((r) => {
          const reasons = (r.reasons as { points: number; why: string }[] | null) ?? [];
          const ip = r.ipInfo as { country?: string | null; type?: string | null; provider?: string | null } | null;
          const others = linked.get(r.id) ?? [];
          return (
            <tr key={r.id} className="align-top">
              <td className="px-4 py-3"><Link href={`/admin/customers/${r.user.id}`} className="text-primary">{r.user.name}</Link><span className="block text-xs text-muted">{r.user.email}</span>
                {others.length > 0 && (
                  <span className="mt-1 block text-xs text-[#B45309]">
                    Linked: {others.slice(0, 4).map((o, i) => <span key={o.id}>{i ? ", " : ""}<Link href={`/admin/customers/${o.id}`} className="underline">{o.name}</Link> ({o.sameDevice ? "same browser" : "same IP"})</span>)}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">{offer(r.offer)}<span className="block text-xs text-muted">{r.createdAt.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</span></td>
              <td className="max-w-[240px] break-all px-4 py-3 text-xs"><a href={r.link} target="_blank" rel="noopener noreferrer" className="text-primary">{r.link}</a>{r.handle && <span className="block text-muted">{r.handle}</span>}</td>
              <td className="px-4 py-3 text-xs">{r.phone ?? "—"}{r.phoneVerifiedAt && <span className="block font-semibold text-[#166534]">✓ WhatsApp</span>}
                {ip && <span className="block text-muted">{[ip.country, ip.type, ip.provider].filter(Boolean).join(" · ")}</span>}
              </td>
              <td className="px-4 py-3 text-xs">
                {r.status !== "AWAITING_PHONE" && <span className={`inline-block rounded-full px-2 py-0.5 font-bold ${tone(r.risk)}`}>{r.risk}</span>}
                {reasons.length > 0 && <ul className="mt-1 space-y-0.5 text-muted">{reasons.map((x) => <li key={x.why}>{x.points > 0 ? "+" : ""}{x.points} {x.why}</li>)}</ul>}
              </td>
              <td className="px-4 py-3 text-xs font-semibold">{STATUS[r.status] ?? r.status}{r.auto && r.status !== "PENDING" ? " (auto)" : ""}
                {r.orderId ? <Link href={`/admin/orders/${r.orderId}`} className="ml-1 text-primary">order</Link> : null}
                {r.note && <span className="block font-normal text-muted">{r.note}</span>}
              </td>
              <td className="px-4 py-3">
                {r.status === "PENDING" && (
                  <div className="flex gap-2">
                    <ActionButton label="Send" confirm="Send this free trial?" action={decideTrialAction.bind(null, r.id, true)} />
                    <ActionButton label="Refuse" prompt="Reason (optional)" className="btn-ghost min-h-9 px-3 text-xs text-danger" action={decideTrialAction.bind(null, r.id, false)} />
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </Table>

      <section className="card mt-8 space-y-4 p-5">
        <h2 className="text-lg font-bold">Trial rules</h2>
        <ActionForm action={saveTrialSettings} className="space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="trialEnabled" defaultChecked={s.trialEnabled} /> Free trials on</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="trialStrict" defaultChecked={s.trialStrict} /> Only after a first top-up</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="trialAutoApprove" defaultChecked={s.trialAutoApprove} /> Send low-risk trials automatically</label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold text-muted">Send automatically below (risk points)<input name="trialAutoBelow" defaultValue={s.trialAutoBelow} inputMode="numeric" className={`${input} mt-1`} /></label>
            <label className="text-xs font-bold text-muted">Refuse from (risk points)<input name="trialRefuseAt" defaultValue={s.trialRefuseAt} inputMode="numeric" className={`${input} mt-1`} /></label>
            <label className="text-xs font-bold text-muted">Most sent automatically per day<input name="trialAutoPerDay" defaultValue={s.trialAutoPerDay} inputMode="numeric" className={`${input} mt-1`} /></label>
            <label className="text-xs font-bold text-muted">Most trials per day (all)<input name="trialPerDay" defaultValue={s.trialPerDay} inputMode="numeric" className={`${input} mt-1`} /></label>
            <label className="text-xs font-bold text-muted">Most per internet connection per day<input name="trialPerIpPerDay" defaultValue={s.trialPerIpPerDay} inputMode="numeric" className={`${input} mt-1`} /></label>
          </div>
          <p className="text-xs text-muted">
            Risk points: VPN/proxy +45 · same phone model and settings as another trial +30 · same internet connection as another trial (30 days) +25 ·
            browser shared with other accounts +20 · outside Haiti +15 · account less than 1 hour old +10 · connection not checked +5 · already topped up −15.
            Always blocked: same account, phone, link, social account or browser; throwaway email; email not confirmed.
          </p>
          <button className="btn-primary min-h-10">Save</button>
        </ActionForm>
      </section>
    </>
  );
}
