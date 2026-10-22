"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMoneyExchange } from "@/actions/admin";
import { customerRate, quoteAmount } from "@/lib/amount";
import { steppedTiers, type ExchangePricing } from "@/lib/amount";
import { withStepUp } from "./ActionButton";

/** Amounts are edited in dollars; the setting stores cents. */
type Row = { upTo: string; fee: string };
const toRows = (tiers: ExchangePricing["tiers"]): Row[] => tiers.map((t) => ({ upTo: String(t.upTo / 100), fee: String(t.fee / 100) }));
const num = (s: string) => Number(String(s).replace(",", "."));
const cents = (s: string) => Math.round(num(s) * 100);
const usd = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const htg = (c: number) => `${new Intl.NumberFormat("fr-HT").format(c / 100)} HTG`;

export function ExchangeEditor({ initial, categories }: { initial: ExchangePricing; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? "");
  const [market, setMarket] = useState(String(initial.marketRate));
  const [margin, setMargin] = useState(String(initial.margin));
  const [min, setMin] = useState(String(initial.min / 100));
  const [max, setMax] = useState(String(initial.max / 100));
  const [presets, setPresets] = useState(initial.presets.join(", "));
  const [rows, setRows] = useState<Row[]>(toRows(initial.tiers));
  const [above, setAbove] = useState(String(initial.abovePercent));
  const [gen, setGen] = useState({ step: "40", first: "2", plus: "1", until: "400" });
  const [test, setTest] = useState("30");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const pricing: ExchangePricing = {
    categoryId: categoryId || null,
    marketRate: num(market) || 0,
    margin: num(margin) || 0,
    min: cents(min),
    max: cents(max),
    presets: presets.split(",").map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0),
    tiers: rows.map((r) => ({ upTo: cents(r.upTo), fee: cents(r.fee) })).filter((t) => t.upTo > 0 && t.fee >= 0),
    abovePercent: num(above) || 0,
  };
  const sorted = [...pricing.tiers].sort((a, b) => a.upTo - b.upTo);
  const last = sorted.at(-1)?.upTo ?? 0;
  const testCents = cents(test);
  const q = testCents > 0 ? quoteAmount(pricing, testCents) : null;
  const marketCost = q ? Math.round((q.amount * pricing.marketRate) / 100) * 100 : 0;
  const setRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="font-bold">Which products</h2>
          <label className="block max-w-md">
            <span className="label">Exchange category</span>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="mt-1 block text-xs text-muted">Every product in this category and its subcategories follows the rules below. No setting on each product.</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label><span className="label">Minimum (USD)</span><input className="input" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} /></label>
            <label><span className="label">Maximum (USD)</span><input className="input" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} /></label>
            <label><span className="label">Quick amounts (USD, commas)</span><input className="input" value={presets} onChange={(e) => setPresets(e.target.value)} /></label>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-bold">Rate</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label><span className="label">Market rate (HTG for 1 USD)</span><input className="input" inputMode="decimal" value={market} onChange={(e) => setMarket(e.target.value)} /></label>
            <label><span className="label">Your margin (HTG)</span><input className="input" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} /></label>
            <div>
              <span className="label">Customers see</span>
              <p className="flex min-h-11 items-center rounded-xl bg-success-soft px-3 font-bold text-success">1 USD = {customerRate(pricing)} HTG</p>
            </div>
          </div>
          <p className="text-xs text-muted">When the market moves, change only the market rate. Your margin, and so your profit per dollar, stays the same.</p>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-bold">Fee table</h2>
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-2 p-3 text-sm">
            <span className="w-full font-semibold">Fill the table automatically</span>
            <label className="w-24"><span className="label">Every (USD)</span><input className="input" inputMode="decimal" value={gen.step} onChange={(e) => setGen({ ...gen, step: e.target.value })} /></label>
            <label className="w-24"><span className="label">First fee</span><input className="input" inputMode="decimal" value={gen.first} onChange={(e) => setGen({ ...gen, first: e.target.value })} /></label>
            <label className="w-24"><span className="label">+ each step</span><input className="input" inputMode="decimal" value={gen.plus} onChange={(e) => setGen({ ...gen, plus: e.target.value })} /></label>
            <label className="w-24"><span className="label">Until (USD)</span><input className="input" inputMode="decimal" value={gen.until} onChange={(e) => setGen({ ...gen, until: e.target.value })} /></label>
            <button
              type="button"
              className="btn-secondary min-h-11 px-3"
              onClick={() => {
                const step = cents(gen.step), until = cents(gen.until);
                if (step > 0 && until >= step && until / step <= 20) setRows(toRows(steppedTiers(step, until, cents(gen.first), cents(gen.plus))));
              }}
            >
              Fill
            </button>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => {
              const upTo = cents(r.upTo);
              const prev = [...sorted].reverse().find((t) => t.upTo < upTo);
              return (
                <div key={i} className="flex flex-wrap items-end gap-2" data-testid="fee-row">
                  <span className="w-28 pb-3 text-sm text-muted">{prev ? `over ${usd(prev.upTo)}` : `from ${usd(pricing.min)}`}</span>
                  <label className="w-28"><span className="label">Up to (USD)</span><input className="input" inputMode="decimal" value={r.upTo} onChange={(e) => setRow(i, { upTo: e.target.value })} /></label>
                  <label className="w-24"><span className="label">Fee (USD)</span><input className="input" inputMode="decimal" value={r.fee} onChange={(e) => setRow(i, { fee: e.target.value })} /></label>
                  <button type="button" className="min-h-11 px-2 text-sm font-semibold text-danger" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>Remove</button>
                </div>
              );
            })}
          </div>
          <button type="button" className="btn-secondary min-h-10 px-3 text-sm" onClick={() => setRows((x) => [...x, { upTo: "", fee: "" }])}>+ Add a row</button>
          <label className="block max-w-xs">
            <span className="label">Over {usd(last)}: fee in % of the amount</span>
            <input className="input" inputMode="decimal" value={above} onChange={(e) => setAbove(e.target.value)} />
          </label>
        </section>

        <button
          type="button"
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await withStepUp(() => saveMoneyExchange(pricing));
              setMsg(r.ok ? { ok: true, text: r.message ?? "Saved" } : { ok: false, text: r.error });
              router.refresh();
            })
          }
        >
          {pending ? "Saving…" : "Save exchange rules"}
        </button>
        {msg && <p role="status" className={`rounded-xl px-4 py-2.5 text-sm ${msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{msg.text}</p>}
      </div>

      <aside className="card h-fit space-y-3 p-5 xl:sticky xl:top-6">
        <h2 className="font-bold">Calculator</h2>
        <label><span className="label">Customer wants (USD)</span><input className="input text-lg font-bold" inputMode="decimal" value={test} onChange={(e) => setTest(e.target.value)} /></label>
        {q && (
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Fee</dt><dd className="font-semibold">{usd(q.fee)}{q.amount > last ? ` (${pricing.abovePercent}%)` : ""}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Customer pays</dt><dd className="text-lg font-bold">{htg(q.totalHtg)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Cost at market rate</dt><dd>{htg(marketCost)}</dd></div>
            <div className="flex justify-between border-t border-border pt-1.5"><dt className="font-semibold">Your profit</dt><dd className="font-bold text-success">{htg(q.totalHtg - marketCost)}</dd></div>
          </dl>
        )}
        {(testCents < pricing.min || testCents > pricing.max) && <p className="text-xs text-danger">Customers can only ask between {usd(pricing.min)} and {usd(pricing.max)}.</p>}
        <p className="text-xs text-muted">Profit = your margin on the dollars + the fee, before your own transfer costs.</p>
      </aside>
    </div>
  );
}
