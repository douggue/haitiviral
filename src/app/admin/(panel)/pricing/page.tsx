import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { t as txt } from "@/lib/text";
import { VIP_LEVELS } from "@/lib/vip";
import { avgText, listChoices, profitOf, realAverages } from "@/lib/suppliers/catalog";
import { savePricing, setChoicePrice } from "@/actions/catalog";
import { ActionButton, ActionForm } from "@/components/admin/ActionButton";
import { PageTitle, Table } from "@/components/admin/ui";

export const metadata = { title: "Pricing & profit" };

const g = (c: number) => `${c < 0 ? "−" : ""}G ${Math.abs(Math.round(c / 100)).toLocaleString("en-US")}`;
const STATUS = {
  ok: ["OK", "#DCFCE7", "#166534"],
  low: ["Low margin", "#FEF3C7", "#92400E"],
  loss: ["Loss", "#FEE2E2", "#991B1B"],
  nocost: ["Not linked", "#F1F5F9", "#475569"],
} as const;

/**
 * Pricing and real profit (mockup "Pricing, real profit and curated picks"): per 1,000, what the provider charges,
 * what we sell for, and what is left in the worst case (biggest VIP discount + payment fee). Choices that lose
 * money are paused automatically when the switch is on. Also the real average delivery time from our own orders.
 */
export default async function PricingAdmin() {
  await requireStaff("settings.manage");
  const [s, choices, avg] = await Promise.all([getSettings(), listChoices(), realAverages()]);
  const rows = choices.map((c) => ({ c, p: profitOf(c.priceHtg, c.provider ? Number(c.provider.rate) : null, s), a: avg.get(c.id) }));
  const n = (k: keyof typeof STATUS) => rows.filter((r) => r.p.status === k).length;
  const vipMax = Math.max(...VIP_LEVELS.map((l) => l.discount));

  return (
    <>
      <PageTitle title="Pricing & real profit" sub={`${n("ok")} OK · ${n("low")} low margin · ${n("loss")} losing${s.autoPauseLoss ? " (paused)" : ""} · ${n("nocost")} not linked to a provider`} />

      <ActionForm action={savePricing} className="card mb-6 grid gap-3 p-5 sm:grid-cols-5 sm:items-end">
        <label><span className="label">Exchange rate (HTG per $1)</span><input name="htgPerUsd" defaultValue={s.htgPerUsd} inputMode="decimal" className="input" /></label>
        <label><span className="label">Payment fee %</span><input name="paymentFeePct" defaultValue={s.paymentFeePct} inputMode="decimal" className="input" /></label>
        <label><span className="label">Minimum profit %</span><input name="minProfitPct" defaultValue={s.minProfitPct} inputMode="decimal" className="input" /></label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="autoPauseLoss" defaultChecked={s.autoPauseLoss} /> Pause choices that lose money</label>
        <button className="btn-primary min-h-11">Save</button>
      </ActionForm>

      <h2 className="mb-1 text-lg font-bold">Real profit per 1,000 (worst case)</h2>
      <p className="mb-3 text-xs text-muted">Worst case = Diamond customer (−{vipMax}%) paying with a {s.paymentFeePct}% fee. The referral reward is a one-time amount per new customer, so it isn&apos;t counted here.</p>
      <Table head={["Choice", "Provider cost", "= in HTG", "Selling price", `VIP −${vipMax}%`, "Pay fee", "Real profit", "Status", "Real avg time"]} empty={!rows.length}>
        {rows.map(({ c, p, a }) => {
          const st = STATUS[p.status];
          return (
            <tr key={c.id}>
              <td className="px-4 py-3">
                <span className="font-semibold">{txt(c.product.name, "ht")}</span>
                <span className="block text-xs text-muted">{txt(c.name, "ht")}{!c.isActive ? " · OFF" : ""}</span>
              </td>
              <td className="px-4 py-3 tabular-nums">{c.provider ? `$${Number(c.provider.rate).toFixed(2)}` : "—"}</td>
              <td className="px-4 py-3 tabular-nums">{c.provider ? g(p.costHtg) : "—"}</td>
              <td className="px-4 py-3">
                <ActionButton label={g(p.sell)} prompt={`New selling price per 1,000 in gourdes (now ${(p.sell / 100).toLocaleString("en-US")})`} className="rounded-lg border border-border px-2 py-1 text-sm font-semibold tabular-nums hover:border-primary" action={setChoicePrice.bind(null, c.id)} />
              </td>
              <td className="px-4 py-3 tabular-nums text-muted">−{g(p.vip)}</td>
              <td className="px-4 py-3 tabular-nums text-muted">−{g(p.fee)}</td>
              <td className="px-4 py-3 font-extrabold tabular-nums" style={{ color: st[2] }}>{p.status === "nocost" ? "—" : `${g(p.profit)} (${Math.round(p.pct)}%)`}</td>
              <td className="px-4 py-3"><span className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: st[1], color: st[2] }}>{p.status === "loss" && c.meta.pausedLoss ? "Loss: paused" : st[0]}</span></td>
              <td className="px-4 py-3 text-xs">{a ? `${avgText(a.minutes).fr} · ${a.orders} order${a.orders > 1 ? "s" : ""}` : <span className="text-muted">shown: {txt(c.meta.avg, "fr")}</span>}</td>
            </tr>
          );
        })}
      </Table>
      <p className="mt-3 text-xs text-muted">Customers see the real average time once a choice has 5 full deliveries in the last 30 days (updated with the daily provider sync).</p>
    </>
  );
}
