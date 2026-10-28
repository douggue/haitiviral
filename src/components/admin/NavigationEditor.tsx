"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveNavigation } from "@/actions/site";
import type { NavLink } from "@/lib/settings";
import { DEFAULT_FOOTER_HELP, DEFAULT_FOOTER_SERVICES } from "@/lib/footer-links";

const LOCALES = ["ht", "fr"] as const;
type Nav = { header: NavLink[]; footer: NavLink[]; footerServices?: NavLink[]; footerHelp?: NavLink[] };

function LinkList({ title, hint, links, standard, onChange }: { title: string; hint: string; links: NavLink[]; standard?: NavLink[]; onChange: (l: NavLink[]) => void }) {
  const set = (i: number, l: NavLink) => onChange(links.map((x, j) => (j === i ? l : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= links.length) return;
    const n = [...links];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-xs text-muted">{hint}</p>
      {links.length === 0 && standard && (
        <div className="space-y-2 rounded-xl bg-surface-2 p-3 text-sm">
          <p className="text-muted">Showing the standard list: {standard.map((l) => l.label.ht).join(" · ")}</p>
          <button type="button" className="btn-secondary min-h-9 px-3 text-xs" onClick={() => onChange(standard)}>Edit this list</button>
        </div>
      )}
      {links.length === 0 && !standard && <p className="text-sm text-muted">No links.</p>}
      {links.map((l, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex gap-2">
            <input className="input" aria-label="Link address" placeholder="/order or https://…" value={l.href} onChange={(e) => set(i, { ...l, href: e.target.value })} />
            <button type="button" className="btn-ghost min-h-11 px-2" onClick={() => move(i, -1)} aria-label="Move up">▲</button>
            <button type="button" className="btn-ghost min-h-11 px-2" onClick={() => move(i, 1)} aria-label="Move down">▼</button>
            <button type="button" className="btn-ghost min-h-11 px-2 text-danger" onClick={() => onChange(links.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {LOCALES.map((loc) => <input key={loc} className="input" aria-label={`Label ${loc}`} placeholder={loc.toUpperCase()} value={l.label[loc] ?? ""} onChange={(e) => set(i, { ...l, label: { ...l.label, [loc]: e.target.value } })} />)}
          </div>
        </div>
      ))}
      <button type="button" className="btn-secondary min-h-9 px-3 text-xs" onClick={() => onChange([...links, { label: {}, href: "/" }])}>+ Add link</button>
    </section>
  );
}

export function NavigationEditor({ initial }: { initial: Nav }) {
  const router = useRouter();
  const [nav, setNav] = useState<Nav>({ ...initial, footerServices: initial.footerServices ?? [], footerHelp: initial.footerHelp ?? [] });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <LinkList title="Footer · service buttons" hint="The round buttons under “Sèvis nou yo”. Empty = the standard list." links={nav.footerServices ?? []} standard={DEFAULT_FOOTER_SERVICES} onChange={(footerServices) => setNav({ ...nav, footerServices })} />
        <LinkList title="Footer · help links" hint="The links under “Èd”. Empty = the standard list." links={nav.footerHelp ?? []} standard={DEFAULT_FOOTER_HELP} onChange={(footerHelp) => setNav({ ...nav, footerHelp })} />
        <LinkList title="Footer · extra legal links" hint="Added after Terms, Privacy and Refunds. Custom pages with “Link in footer” are added automatically." links={nav.footer} onChange={(footer) => setNav({ ...nav, footer })} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => { const r = await saveNavigation(nav); setMsg(r.ok ? { ok: true, text: r.message ?? "Saved" } : { ok: false, text: r.error }); router.refresh(); })}>Publish footer</button>
      </div>
      {msg && <p className={`rounded-xl px-4 py-2.5 text-sm ${msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
