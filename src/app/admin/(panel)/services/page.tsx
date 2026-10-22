import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { t as txt } from "@/lib/text";
import { PLATFORMS } from "@/lib/services";
import { analyzeRisk, rulesToText, type RiskLevel } from "@/lib/service-risk";
import { listChoices, suggestRisk } from "@/lib/suppliers/catalog";
import { linkChoiceAction, reanalyzeAction, saveRiskRules, saveServiceStatus, setRiskAction, syncProvidersAction } from "@/actions/catalog";
import { ActionButton, ActionForm } from "@/components/admin/ActionButton";
import { PageTitle, Table } from "@/components/admin/ui";

export const metadata = { title: "Services & risk" };

const BADGE: Record<RiskLevel, [string, string, string]> = {
  low: ["Low", "#DCFCE7", "#166534"],
  med: ["Medium", "#FEF3C7", "#92400E"],
  high: ["High", "#FEE2E2", "#991B1B"],
  blocked: ["Blocked", "#0F172A", "#FFFFFF"],
};
const Badge = ({ level }: { level: RiskLevel }) => (
  <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: BADGE[level][1], color: BADGE[level][2] }}>{BADGE[level][0]}</span>
);
const Why = ({ items }: { items: string[] }) => (
  <span className="flex flex-wrap gap-1">
    {items.map((w) => (
      <span key={w} className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold ${w.startsWith("+") ? "bg-[#FEE2E2] text-[#991B1B]" : w.startsWith("−") ? "bg-[#DCFCE7] text-[#166534]" : "bg-surface-2 text-muted"}`}>{w}</span>
    ))}
  </span>
);

/**
 * Services & risk (mockup "Services · risk analysis"): every choice sold on the site, the provider service behind it,
 * the level suggested from the provider's words, and staff's final say (locked). Plus the editable clue rules,
 * blocked words, the services status shown to customers, and a search in the providers' full lists.
 */
export default async function ServicesAdmin({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  await requireStaff("catalog.manage");
  const { q = "", p = "" } = await searchParams;
  const [settings, choices, suppliers, known] = await Promise.all([
    getSettings(),
    listChoices(),
    prisma.supplier.findMany({ where: { preset: { in: ["smm_panel", "smm_mock"] } }, orderBy: { createdAt: "asc" } }),
    prisma.providerService.count({ where: { removedAt: null } }),
  ]);
  const rows = choices.map((c) => ({ c, s: suggestRisk(c, settings), level: (c.meta.blocked ? "blocked" : c.meta.risk) as RiskLevel }));
  const count = (l: RiskLevel) => rows.filter((r) => r.level === l).length;
  const platforms = [...new Map(choices.map((c) => [c.product.category.slug, c.product.category])).values()];
  const search = q.trim()
    ? await prisma.providerService.findMany({
        where: { removedAt: null, ...(p ? { supplierId: p } : {}), OR: [{ name: { contains: q.trim(), mode: "insensitive" } }, { category: { contains: q.trim(), mode: "insensitive" } }, { serviceId: q.trim() }] },
        include: { supplier: { select: { name: true } } },
        orderBy: { rate: "asc" },
        take: 60,
      })
    : [];

  return (
    <>
      <PageTitle
        title="Services · risk analysis"
        sub="Levels are suggested from the provider's own words. You have the final say: a level you pick is locked."
        actions={
          <div className="flex flex-wrap gap-2">
            <ActionButton label="Sync from providers" action={syncProvidersAction.bind(null, null)} />
            <ActionButton label="Re-analyze all" action={reanalyzeAction} />
          </div>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["low", "med", "high", "blocked"] as const).map((l) => (
          <div key={l} className="card flex flex-col gap-2 p-4"><Badge level={l} /><span className="text-2xl font-extrabold tabular-nums">{count(l)}</span></div>
        ))}
        <div className="card flex flex-col gap-2 p-4"><span className="text-xs font-semibold text-muted">Provider services known</span><span className="text-2xl font-extrabold tabular-nums">{known.toLocaleString("en-US")}</span></div>
      </section>

      {!suppliers.length && (
        <p className="mb-6 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          No SMM provider yet. Add one in <Link href="/admin/suppliers" className="font-semibold underline">Suppliers</Link> (type &quot;SMM panel&quot;, paste its API address and key), then press Sync.
        </p>
      )}

      <h2 className="mb-3 text-lg font-bold">Choices sold on the site</h2>
      <Table head={["Choice", "Provider service", "Suggested", "Why", "Your level", "Provider link"]} empty={!rows.length}>
        {rows.map(({ c, s, level }) => (
          <tr key={c.id} className="align-top">
            <td className="px-4 py-3">
              <span className="font-semibold">{txt(c.product.name, "ht")}</span>
              <span className="block text-xs text-muted">{txt(c.name, "ht")} · G {(c.priceHtg / 100).toLocaleString("en-US")}/1K</span>
              {!c.isActive && <span className="mt-1 inline-block rounded bg-surface-2 px-1.5 text-[11px] font-bold text-muted">OFF{c.meta.pausedLoss ? " · loss" : c.meta.blocked ? " · blocked" : ""}</span>}
            </td>
            <td className="max-w-[280px] px-4 py-3">
              {c.provider ? (
                <>
                  <span className="block text-sm">{c.provider.name}</span>
                  <span className="block text-xs text-muted">{c.supplier?.name} #{c.provider.serviceId} · ${Number(c.provider.rate).toFixed(2)}/1K{c.provider.refill ? " · refill" : ""}{c.provider.removedAt ? " · GONE from provider" : ""}</span>
                  {c.backup && <span className="block text-xs text-muted">Backup: {c.backupSupplier?.name} #{c.backup.serviceId}</span>}
                </>
              ) : (
                <span className="text-xs text-muted">Not linked{c.meta.desc ? ` · own text: ${c.meta.desc}` : ""}</span>
              )}
            </td>
            <td className="px-4 py-3"><Badge level={s.level} /><span className="mt-1 block text-[11px] text-muted">score {s.level === "blocked" ? "—" : s.score > 0 ? `+${s.score}` : s.score === 0 ? "0" : `−${-s.score}`}</span></td>
            <td className="px-4 py-3"><Why items={s.why} /></td>
            <td className="px-4 py-3">
              <ActionForm action={setRiskAction.bind(null, c.id)} className="flex items-center gap-2">
                <select name="level" defaultValue={c.meta.riskLocked ? level : "auto"} className="input min-h-9 w-auto py-1 text-xs" aria-label="Level">
                  <option value="auto">Use suggestion</option>
                  <option value="low">Low risk</option>
                  <option value="med">Medium risk</option>
                  <option value="high">High risk</option>
                  <option value="blocked">Blocked (never sell)</option>
                </select>
                <button className="btn-secondary min-h-9 px-3 text-xs">Save</button>
              </ActionForm>
              {c.meta.riskLocked && <span className="mt-1 block text-[11px] font-semibold text-primary">🔒 Changed by you · now {BADGE[level][0]}</span>}
            </td>
            <td className="px-4 py-3">
              <details>
                <summary className="cursor-pointer text-xs font-semibold text-primary">{c.provider ? "Change" : "Link"}</summary>
                <ActionForm action={linkChoiceAction.bind(null, c.id)} className="mt-2 grid min-w-[220px] gap-2">
                  <select name="supplierId" defaultValue={c.supplierId ?? ""} className="input min-h-9 py-1 text-xs" aria-label="Provider">
                    <option value="">— none —</option>
                    {suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <input name="sku" defaultValue={c.supplierSku ?? ""} placeholder={c.meta.type === "live" ? "15=201,30=202,60=203" : "Service id, e.g. 1234"} className="input min-h-9 py-1 font-mono text-xs" aria-label="Service id" />
                  <select name="backupSupplierId" defaultValue={c.backupSupplierId ?? ""} className="input min-h-9 py-1 text-xs" aria-label="Backup provider">
                    <option value="">Backup: none</option>
                    {suppliers.map((x) => <option key={x.id} value={x.id}>Backup: {x.name}</option>)}
                  </select>
                  <input name="backupSku" defaultValue={c.backupSupplierSku ?? ""} placeholder="Backup service id" className="input min-h-9 py-1 font-mono text-xs" aria-label="Backup service id" />
                  <button className="btn-primary min-h-9 text-xs">Save link</button>
                </ActionForm>
              </details>
            </td>
          </tr>
        ))}
      </Table>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card space-y-3 p-5">
          <h2 className="text-lg font-bold">Clue rules (editable)</h2>
          <p className="text-xs text-muted">One rule per line: points, then the words. Score ≤ −2 = Low · −1 to +1 = Medium · ≥ +2 = High. &quot;kind:followers&quot; matches the service kind; &quot;speed:fast&quot; = 10K+ a day, &quot;speed:slow&quot; = under 1K a day. Longer words are matched first, so &quot;no refill&quot; is not also counted as &quot;refill&quot;.</p>
          <ActionForm action={saveRiskRules} className="space-y-3">
            <textarea name="rules" rows={14} defaultValue={rulesToText(settings.riskRules)} className="input font-mono text-xs" spellCheck={false} />
            <label className="block">
              <span className="label">Blocked categories (one per line: never sold)</span>
              <textarea name="blocked" rows={5} defaultValue={settings.riskBlocked.join("\n")} className="input font-mono text-xs" spellCheck={false} />
            </label>
            <button className="btn-primary min-h-10">Save rules and re-analyze</button>
          </ActionForm>
        </div>

        <div className="space-y-6">
          <div className="card space-y-3 p-5">
            <h2 className="text-lg font-bold">Services status (shown to customers)</h2>
            <p className="text-xs text-muted">Slow = a notice on the home and help pages. Paused = also no new orders for that platform.</p>
            <ActionForm action={saveServiceStatus} className="space-y-2">
              {platforms.map((pl) => (
                <label key={pl.slug} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold">{PLATFORMS[pl.slug]?.name ?? txt(pl.name, "fr")}</span>
                  <select name={`status_${pl.slug}`} defaultValue={settings.serviceStatus[pl.slug] ?? "ok"} className="input min-h-9 w-auto py-1 text-xs">
                    <option value="ok">Normal</option>
                    <option value="slow">Slow</option>
                    <option value="pause">Paused</option>
                  </select>
                </label>
              ))}
              <button className="btn-primary min-h-10">Save status</button>
            </ActionForm>
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="text-lg font-bold">Find a provider service</h2>
            <form className="flex flex-wrap gap-2">
              <input name="q" defaultValue={q} placeholder="tiktok followers, refill, 1234…" className="input min-h-10 flex-1" />
              <select name="p" defaultValue={p} className="input min-h-10 w-auto">
                <option value="">All providers</option>
                {suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <button className="btn-secondary min-h-10 px-4">Search</button>
            </form>
            {q && !search.length && <p className="text-sm text-muted">Nothing found. Did you press Sync?</p>}
            <ul className="divide-y divide-border">
              {search.map((x) => {
                const r = analyzeRisk({ name: x.name, desc: x.desc, category: x.category, kind: null }, settings.riskRules, settings.riskBlocked);
                return (
                  <li key={x.id} className="flex items-start justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-sm">{x.name}</span>
                      <span className="block text-xs text-muted">{x.supplier.name} · <b className="font-mono">#{x.serviceId}</b> · {x.category} · ${Number(x.rate).toFixed(3)}/1K · {x.min.toLocaleString("en-US")}–{x.max.toLocaleString("en-US")}{x.refill ? " · refill" : ""}{x.dripfeed ? " · drip" : ""}</span>
                    </span>
                    <Badge level={r.level} />
                  </li>
                );
              })}
            </ul>
            {!!search.length && <p className="text-[11px] text-muted">The level here doesn&apos;t count the service kind; it is added once linked to a choice.</p>}
          </div>
        </div>
      </section>
    </>
  );
}

