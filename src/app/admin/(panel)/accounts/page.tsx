import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { t as txt } from "@/lib/text";
import { accountPrice, parseAccountMeta } from "@/lib/accounts";
import { ACCOUNT_PRESETS } from "@/lib/suppliers/ytseller";
import { removeAccountProduct, saveAccountSettings, sellAccountProduct, syncAccountsAction, updateAccountProduct } from "@/actions/accounts";
import { ActionButton, ActionForm } from "@/components/admin/ActionButton";
import { PageTitle, Table } from "@/components/admin/ui";

export const metadata = { title: "Accounts & SMS" };

const money = (n: number) => formatMoney(n, "HTG", "en");
const input = "h-9 w-full rounded-lg border border-[#CBD2E1] bg-surface px-2 text-sm dark:border-border";
const area = "w-full rounded-lg border border-[#CBD2E1] bg-surface p-2 text-sm dark:border-border";
const label = "text-xs font-bold text-muted";

/**
 * Accounts & SMS numbers sold through the accounts provider (YTSeller).
 * On sale: our products (own name, text, price) with cost, margin and the provider's stock.
 * Provider products: everything the provider lists; "Sell" puts one on sale. Stock is synced every hour.
 */
export default async function AccountsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  await requireStaff("catalog.manage");
  const { q = "", cat = "" } = await searchParams;
  const s = await getSettings();
  const suppliers = await prisma.supplier.findMany({ where: { preset: { in: ACCOUNT_PRESETS } }, orderBy: { createdAt: "asc" } });
  const ids = suppliers.map((x) => x.id);
  const [mine, provider, cats] = await Promise.all([
    prisma.productVariant.findMany({ where: { account: { not: Prisma.DbNull }, product: { isPublished: true } }, include: { product: true }, orderBy: { createdAt: "desc" } }),
    prisma.providerService.findMany({
      where: { supplierId: { in: ids }, removedAt: null, ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}), ...(cat ? { category: cat } : {}) },
      orderBy: [{ category: "asc" }, { rate: "asc" }], take: 200,
    }),
    prisma.providerService.groupBy({ by: ["category"], where: { supplierId: { in: ids }, removedAt: null }, _count: true, orderBy: { category: "asc" } }),
  ]);
  const services = await prisma.providerService.findMany({ where: { OR: mine.filter((v) => v.supplierId && v.supplierSku).map((v) => ({ supplierId: v.supplierId!, serviceId: v.supplierSku! })) } });
  const ps = (supplierId: string | null, sku: string | null) => services.find((p) => p.supplierId === supplierId && p.serviceId === sku);
  const selling = new Set(mine.map((v) => `${v.supplierId}:${v.supplierSku}`));
  const cost = (usd: number) => Math.round(usd * s.htgPerUsd * 100);
  const isSms = (c: string, n: string) => /sms|number|phone|nimewo/i.test(`${c} ${n}`);

  return (
    <>
      <PageTitle
        title="Accounts & SMS"
        sub={`${s.accountsEnabled ? "Shop on" : "Shop OFF"} · ${mine.length} on sale · margin ${s.accountMarginPct}% · warranty ${s.accountWarrantyHours} h · cost at ${s.htgPerUsd} HTG/USD`}
        actions={suppliers.map((x) => <ActionButton key={x.id} label={`Sync ${x.name}`} action={syncAccountsAction.bind(null, x.id)} />)}
      />
      {suppliers.length === 0 && (
        <p className="card mb-6 p-4 text-sm">No accounts provider yet. Go to <Link href="/admin/suppliers" className="text-primary underline">Providers</Link>, add one as <b>&quot;Accounts &amp; SMS numbers (YTSeller)&quot;</b> and paste your API key there, then press Sync here.</p>
      )}
      {suppliers.map((x) => (
        <p key={x.id} className="mb-2 text-xs text-muted">{x.name}: balance {x.balance ? `${Number(x.balance).toFixed(2)} ${x.balanceCurrency ?? "USD"}` : "—"}{x.balanceAt ? ` · synced ${x.balanceAt.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}` : ""}</p>
      ))}

      <h2 className="mb-2 mt-6 text-lg font-bold">On sale</h2>
      <Table head={["Product", "Provider", "Cost / piece", "Price / piece", "Margin", "Stock", "Status", ""]} empty={!mine.length}>
        {mine.map((v) => {
          const meta = parseAccountMeta(v.account)!;
          const p = ps(v.supplierId, v.supplierSku);
          const c = p ? cost(Number(p.rate)) : null;
          const price = v.salePriceHtg ?? v.priceHtg;
          const margin = c ? Math.round(((price - c) / price) * 100) : null;
          const name = v.name as Record<string, string>;
          return (
            <tr key={v.id} className="align-top">
              <td className="px-4 py-3"><span className="font-semibold">{txt(v.name, "ht")}</span><span className="block text-xs text-muted">{meta.kind === "sms" ? "SMS number" : "Account"} · {meta.delivery === "24h" ? "within 24 h" : "instant"} · warranty {meta.warrantyHours} h</span>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-primary">Edit</summary>
                  <ActionForm action={updateAccountProduct.bind(null, v.id)} className="mt-2 grid min-w-[320px] gap-2">
                    <label className={label}>Name (Kreyòl)<input name="name_ht" defaultValue={name.ht} className={input} /></label>
                    <label className={label}>Name (French)<input name="name_fr" defaultValue={name.fr} className={input} /></label>
                    <label className={label}>Text (Kreyòl)<textarea name="about_ht" rows={3} defaultValue={meta.about.ht} className={area} /></label>
                    <label className={label}>Text (French)<textarea name="about_fr" rows={3} defaultValue={meta.about.fr} className={area} /></label>
                    {meta.require && <>
                      <label className={label}>Customer must give (Kreyòl)<input name="require_ht" defaultValue={meta.require.ht} className={input} /></label>
                      <label className={label}>Customer must give (French)<input name="require_fr" defaultValue={meta.require.fr} className={input} /></label>
                    </>}
                    <div className="grid grid-cols-3 gap-2">
                      <label className={label}>Price (HTG)<input name="price" defaultValue={price / 100} inputMode="decimal" className={input} /></label>
                      <label className={label}>Warranty (h)<input name="warrantyHours" defaultValue={meta.warrantyHours} inputMode="numeric" className={input} /></label>
                      <label className={label}>Delivery<select name="delivery" defaultValue={meta.delivery} className={input}><option value="instant">Instant</option><option value="24h">Within 24 h</option></select></label>
                    </div>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={v.isActive} /> On sale (untick to pause)</label>
                    <div className="flex gap-2"><button className="btn-primary min-h-9 px-3 text-xs">Save</button></div>
                  </ActionForm>
                  <div className="mt-2"><ActionButton label="Remove from shop" confirm="Remove this product from the shop? Past orders stay." className="btn-ghost min-h-9 px-3 text-xs text-danger" action={removeAccountProduct.bind(null, v.id)} /></div>
                </details>
              </td>
              <td className="max-w-[220px] px-4 py-3 text-xs text-muted">#{v.supplierSku} {p?.name ?? "(not listed any more)"}</td>
              <td className="px-4 py-3">{c !== null ? money(c) : "—"}<span className="block text-xs text-muted">{p ? `$${Number(p.rate).toFixed(2)}` : ""}</span></td>
              <td className="px-4 py-3 font-semibold">{money(price)}</td>
              <td className={`px-4 py-3 font-bold ${margin === null ? "" : margin < 15 ? "text-danger" : "text-[#166534]"}`}>{margin === null ? "—" : `${margin}%`}</td>
              <td className="px-4 py-3">{p ? (p.stock === null ? "on order" : p.stock) : "—"}</td>
              <td className="px-4 py-3 text-xs font-semibold">{!v.isActive ? "PAUSED" : v.soldOut ? (c !== null && c >= price ? "PAUSED: cost above price" : "SOLD OUT") : "ON SALE"}</td>
              <td className="px-4 py-3"><Link href={`/ht/accounts/${v.product.slug}`} className="text-xs text-primary" target="_blank">View</Link></td>
            </tr>
          );
        })}
      </Table>

      <h2 className="mb-2 mt-8 text-lg font-bold">Provider products</h2>
      <form className="mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search (gmail, instagram…)" className={`${input} max-w-[260px]`} />
        <select name="cat" defaultValue={cat} className={`${input} max-w-[220px]`}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.category} value={c.category}>{c.category} ({c._count})</option>)}
        </select>
        <button className="btn-secondary min-h-9 px-3 text-xs">Filter</button>
      </form>
      <Table head={["Product", "Category", "Cost / piece", "Suggested price", "Min–max", "Stock", ""]} empty={!provider.length}>
        {provider.map((p) => {
          const c = cost(Number(p.rate));
          const suggested = accountPrice(Number(p.rate), s.htgPerUsd, s.accountMarginPct);
          const sms = isSms(p.category, p.name);
          return (
            <tr key={p.id} className="align-top">
              <td className="max-w-[320px] px-4 py-3"><span className="font-semibold">#{p.serviceId} {p.name}</span>{p.desc && <span className="block text-xs text-muted">{p.desc.slice(0, 160)}</span>}{p.require && <span className="block text-xs text-[#B45309]">Needs from customer: {p.require}</span>}</td>
              <td className="px-4 py-3 text-xs">{p.category}</td>
              <td className="px-4 py-3">{money(c)}<span className="block text-xs text-muted">${Number(p.rate).toFixed(2)}</span></td>
              <td className="px-4 py-3 font-semibold">{money(suggested)}</td>
              <td className="px-4 py-3 text-xs">{p.min}–{p.max}</td>
              <td className="px-4 py-3">{p.stock === null ? "on order" : p.stock === 0 ? <span className="text-danger">0</span> : p.stock}</td>
              <td className="px-4 py-3">
                {selling.has(`${p.supplierId}:${p.serviceId}`) ? <span className="text-xs font-semibold text-[#166534]">Listed</span> : (
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold text-primary">Sell</summary>
                    <ActionForm action={sellAccountProduct.bind(null, p.supplierId, p.serviceId)} className="mt-2 grid min-w-[300px] gap-2">
                      <label className={label}>Name (Kreyòl)<input name="name_ht" placeholder="Kont Gmail ansyen" className={input} /></label>
                      <label className={label}>Name (French)<input name="name_fr" placeholder="Compte Gmail ancien" className={input} /></label>
                      <label className={label}>Text (Kreyòl)<textarea name="about_ht" rows={2} className={area} /></label>
                      <label className={label}>Text (French)<textarea name="about_fr" rows={2} className={area} /></label>
                      {p.require && <>
                        <label className={label}>Customer must give (Kreyòl)<input name="require_ht" placeholder={p.require} className={input} /></label>
                        <label className={label}>Customer must give (French)<input name="require_fr" placeholder={p.require} className={input} /></label>
                      </>}
                      <div className="grid grid-cols-2 gap-2">
                        <label className={label}>Kind<select name="kind" defaultValue={sms ? "sms" : "account"} className={input}><option value="account">Account</option><option value="sms">SMS number</option></select></label>
                        <label className={label}>Price (HTG)<input name="price" defaultValue={suggested / 100} inputMode="decimal" className={input} /></label>
                        <label className={label}>Warranty (h)<input name="warrantyHours" defaultValue={sms ? 0 : s.accountWarrantyHours} inputMode="numeric" className={input} /></label>
                        <label className={label}>Delivery<select name="delivery" defaultValue={p.type === "api" || p.stock === null ? "24h" : "instant"} className={input}><option value="instant">Instant</option><option value="24h">Within 24 h</option></select></label>
                      </div>
                      <button className="btn-primary min-h-9 px-3 text-xs">Put on sale</button>
                    </ActionForm>
                  </details>
                )}
              </td>
            </tr>
          );
        })}
      </Table>

      <section className="card mt-8 space-y-4 p-5">
        <h2 className="text-lg font-bold">Shop settings</h2>
        <ActionForm action={saveAccountSettings} className="space-y-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="accountsEnabled" defaultChecked={s.accountsEnabled} /> Accounts &amp; SMS shop on</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Default margin over cost (%)<input name="accountMarginPct" defaultValue={s.accountMarginPct} inputMode="numeric" className={`${input} mt-1`} /></label>
            <label className={label}>Default warranty for accounts (hours, 0 = none)<input name="warrantyHours" defaultValue={s.accountWarrantyHours} inputMode="numeric" className={`${input} mt-1`} /></label>
          </div>
          <p className="text-xs text-muted">A product is taken off sale by itself when the provider has no stock, stops listing it, or its cost goes above our price; it comes back when that&apos;s fixed. Customers must tick the warranty terms before buying. Keep the 24 h default until YTSeller confirms its own warranty in writing.</p>
          <button className="btn-primary min-h-10">Save</button>
        </ActionForm>
      </section>
    </>
  );
}
