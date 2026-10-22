"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { priceIn } from "@/lib/money";
import { indexWords, matchExact, matchFuzzy, tokens } from "@/lib/search";
import { tagIcon } from "@/lib/platforms";
import { useStore } from "./cart/CartProvider";
import { Price } from "./Money";
import { BoltIcon, CloseIcon, SearchIcon } from "./Icons";
import { ProductArt } from "./ProductArt";

export type StoreProduct = {
  id: string;
  /** Every option marked out of stock in Admin */
  soldOut?: boolean;
  slug: string;
  name: string;
  image: string | null;
  accent: string | null;
  tags: string[];
  /** Cheapest option, HTG centimes */
  price: number;
  onSale: boolean;
  instant: boolean;
  delivery: string;
  /** Top-level category slug (a subcategory product counts in its parent) */
  cat: string;
  sub: string | null;
  created: number;
  /** Every text the product can be found by */
  haystack: string[];
};

/** Top-level categories get a tab; subcategories (top: false) are only used for names. */
export type StoreCategory = { slug: string; name: string; icon: string | null; top: boolean };

type Init = { q: string; category: string; sort: string; tags: string[]; min: string; max: string };

const VIEW_KEY = "hg_store_view";
const FAV_KEY = "hg_favorites";

function readList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * The store: everything filters in the browser while you type or tap, no page reload.
 * The address bar follows quietly, so a search can be shared or reopened.
 */
export function StoreBrowser({ products, categories, tags, init }: { products: StoreProduct[]; categories: StoreCategory[]; tags: string[]; init: Init }) {
  const ts = useTranslations("store");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { currency, htgPerUsd } = useStore();

  const [q, setQ] = useState(init.q);
  const [cat, setCat] = useState(init.category);
  const [sort, setSort] = useState(init.sort);
  const [picked, setPicked] = useState<string[]>(init.tags);
  const [min, setMin] = useState(init.min);
  const [max, setMax] = useState(init.max);
  const [favOnly, setFavOnly] = useState(false);
  const [favs, setFavs] = useState<string[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState(!!(init.tags.length || init.min || init.max));

  useEffect(() => {
    setFavs(readList(FAV_KEY));
    try {
      if (localStorage.getItem(VIEW_KEY) === "list") setView("list");
    } catch {}
  }, []);

  const pickView = (v: "grid" | "list") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };
  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
    setFavs(next);
    if (!next.length) setFavOnly(false);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {}
  };

  // Keep the address in step (replace, not push: the Back button leaves the store instead of undoing each letter).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (cat) p.set("category", cat);
    if (sort) p.set("sort", sort);
    if (picked.length) p.set("tag", picked.join(","));
    if (min) p.set("min", min);
    if (max) p.set("max", max);
    const s = p.toString();
    window.history.replaceState(window.history.state, "", `/${locale}/store${s ? `?${s}` : ""}`);
  }, [q, cat, sort, picked, min, max, locale]);

  const index = useMemo(() => new Map(products.map((p) => [p.id, indexWords(p.haystack)])), [products]);

  const toks = tokens(q);
  const searching = toks.join("").length >= 2;
  const minN = Number(min.replace(",", "."));
  const maxN = Number(max.replace(",", "."));
  const shown = (p: StoreProduct) => priceIn(p.price, currency, htgPerUsd) / 100;
  const byPrice = (p: StoreProduct) => (!min || !(minN >= 0) || shown(p) >= minN) && (!max || !(maxN > 0) || shown(p) <= maxN);
  const byTags = (p: StoreProduct) => !picked.length || picked.some((x) => p.tags.includes(x));
  const byCat = (p: StoreProduct, c = cat) => !c || p.cat === c || p.sub === c;
  const byFav = (p: StoreProduct) => !favOnly || favs.includes(p.id);

  // Text search first; nothing found → forgive small typos and say what we understood.
  const { textHits, guess } = useMemo(() => {
    if (!searching) return { textHits: null as Set<string> | null, guess: "" };
    const exact = products.filter((p) => matchExact(index.get(p.id)!, toks));
    if (exact.length) return { textHits: new Set(exact.map((p) => p.id)), guess: "" };
    let words: string[] | null = null;
    const near = products.filter((p) => {
      const fixed = matchFuzzy(index.get(p.id)!, toks);
      if (fixed && !words) words = fixed;
      return !!fixed;
    });
    return { textHits: new Set(near.map((p) => p.id)), guess: near.length && words ? (words as string[]).join(" ") : "" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, index, toks.join(" "), searching]);
  const byText = (p: StoreProduct) => !textHits || textHits.has(p.id);

  const list = useMemo(() => {
    const out = products.filter((p) => byText(p) && byTags(p) && byPrice(p) && byCat(p) && byFav(p));
    if (sort === "price_asc") out.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") out.sort((a, b) => b.price - a.price);
    else if (sort === "newest") out.sort((a, b) => b.created - a.created);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, textHits, picked, min, max, cat, sort, favOnly, favs, currency, htgPerUsd]);

  // Counts show what you'd get after tapping, with the other filters kept.
  const catCount = (c: string) => products.filter((p) => byText(p) && byTags(p) && byPrice(p) && byFav(p) && byCat(p, c)).length;
  const tagCount = (tg: string) => products.filter((p) => byText(p) && byPrice(p) && byCat(p) && byFav(p) && p.tags.includes(tg)).length;

  const activeCount = picked.length + (min ? 1 : 0) + (max ? 1 : 0);
  const anything = !!(q || cat || picked.length || min || max || favOnly);
  const clearAll = () => {
    setQ("");
    setCat("");
    setPicked([]);
    setMin("");
    setMax("");
    setFavOnly(false);
  };
  const toggleTag = (tg: string) => setPicked(picked.includes(tg) ? picked.filter((x) => x !== tg) : [...picked, tg]);

  const tab = (on: boolean) => `shrink-0 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${on ? "glow-btn bg-primary text-white" : "text-muted hover:text-text"}`;
  const pill = (on: boolean) => `rounded-full px-1.5 py-px text-[11px] ${on ? "bg-white/25" : "bg-surface-2"}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-3xl font-bold sm:text-4xl">{ts("title")}</h1>
          <p className="mt-1 text-muted">{ts("subtitle")}</p>
        </div>
        <p className="text-sm text-muted" aria-live="polite">{ts("results", { count: list.length })}</p>
      </div>

      <form className="mt-6 flex flex-col gap-3 sm:flex-row" role="search" onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); }}>
        <label className="relative flex-1">
          <span className="sr-only">{tc("search")}</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width={18} height={18} />
          <input
            name="q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tc("searchPlaceholder")}
            autoComplete="off"
            enterKeyHint="search"
            className={`input pl-9 pr-11 text-base [&::-webkit-search-cancel-button]:hidden ${q ? "border-primary" : ""}`}
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label={ts("clearSearch")} className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg bg-surface-2 text-muted hover:text-text">
              <CloseIcon width={16} height={16} />
            </button>
          )}
        </label>
        <div className="flex gap-2 sm:w-auto">
          <label className="min-w-0 flex-1 sm:w-56 sm:flex-none">
            <span className="sr-only">{ts("sort")}</span>
            <select name="sort" value={sort} onChange={(e) => setSort(e.target.value)} className="input">
              <option value="">{ts("sortFeatured")}</option>
              <option value="price_asc">{ts("sortPriceLow")}</option>
              <option value="price_desc">{ts("sortPriceHigh")}</option>
              <option value="newest">{ts("sortNewest")}</option>
            </select>
          </label>
          <div role="group" aria-label={ts("view")} className="flex shrink-0 gap-1 rounded-xl border border-border bg-surface-2 p-1">
            {(["grid", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => pickView(v)}
                aria-pressed={view === v}
                aria-label={v === "grid" ? ts("viewGrid") : ts("viewList")}
                className={`grid w-10 place-items-center rounded-lg transition-colors ${view === v ? "bg-primary text-white" : "text-muted hover:text-text"}`}
              >
                {v === "grid" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><rect x="4" y="4.5" width="4" height="4" rx="1" /><rect x="4" y="15.5" width="4" height="4" rx="1" /><path d="M11.5 6.5H20M11.5 17.5H20" /></svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </form>

      {searching && (
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {ts("resultsFor", { count: list.length, q: q.trim() })}
          {guess && (
            <>
              {" · "}
              <button type="button" onClick={() => setQ(guess)} className="font-semibold text-primary">{ts("didYouMean", { word: guess })}</button>
            </>
          )}
        </p>
      )}

      <nav className="-mx-4 mt-5 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:rounded-2xl sm:border sm:border-border sm:bg-surface sm:p-1.5" aria-label={tc("categories")}>
        <button type="button" onClick={() => { setCat(""); setFavOnly(false); }} aria-pressed={!cat && !favOnly} className={tab(!cat && !favOnly)}>
          {ts("all")} <span className={pill(!cat && !favOnly)}>{catCount("")}</span>
        </button>
        {categories.filter((c) => c.top).map((c) => {
          const n = catCount(c.slug);
          const on = cat === c.slug;
          return (
            <button key={c.slug} type="button" onClick={() => setCat(on ? "" : c.slug)} aria-pressed={on} className={`${tab(on)} ${!n && !on ? "opacity-50" : ""}`}>
              {c.icon} {c.name} <span className={pill(on)}>{n}</span>
            </button>
          );
        })}
        {favs.length > 0 && (
          <button type="button" onClick={() => setFavOnly(!favOnly)} aria-pressed={favOnly} className={tab(favOnly)}>
            <span className={favOnly ? "" : "text-[#ffc53d]"}>★</span> {ts("favorites")} <span className={pill(favOnly)}>{favs.filter((id) => products.some((p) => p.id === id)).length}</span>
          </button>
        )}
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside>
          <div className="card p-4 lg:sticky lg:top-24">
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between font-bold lg:pointer-events-none">
              <span className="flex items-center gap-2">
                {ts("filters")}
                {activeCount > 0 && <span className="rounded-full bg-primary px-2 py-px text-[11px] text-white">{activeCount}</span>}
              </span>
              <span className={`text-muted transition-transform lg:hidden ${open ? "rotate-180" : ""}`} aria-hidden>▾</span>
            </button>
            <div className={`mt-4 space-y-5 ${open ? "" : "hidden lg:block"}`}>
              {tags.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">{ts("tag")}</p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tg) => {
                      const on = picked.includes(tg);
                      const n = tagCount(tg);
                      const icon = tagIcon(tg);
                      return (
                        <button
                          key={tg}
                          type="button"
                          onClick={() => toggleTag(tg)}
                          aria-pressed={on}
                          className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-3 text-sm font-semibold transition-colors ${on ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-text hover:border-primary"} ${!n && !on ? "opacity-40" : ""}`}
                        >
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-sm" aria-hidden>{on ? "✓" : icon || "#"}</span>
                          {tg}
                          <span className="text-xs font-normal text-muted">{n}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">{ts("price")} ({currency})</p>
                <div className="grid grid-cols-2 gap-2">
                  <label><span className="mb-1 block text-xs text-muted">{ts("priceMin")}</span><input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d.,]/g, ""))} className="input" /></label>
                  <label><span className="mb-1 block text-xs text-muted">{ts("priceMax")}</span><input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d.,]/g, ""))} className="input" /></label>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          {anything && (
            <div className="mb-4 flex flex-wrap items-center gap-2" aria-label={ts("activeFilters")}>
              {q.trim() && <Chip label={`«${q.trim()}»`} onRemove={() => setQ("")} removeLabel={ts("remove", { name: q.trim() })} />}
              {cat && <Chip label={categories.find((c) => c.slug === cat)?.name ?? cat} onRemove={() => setCat("")} removeLabel={ts("remove", { name: cat })} />}
              {favOnly && <Chip label={`★ ${ts("favorites")}`} onRemove={() => setFavOnly(false)} removeLabel={ts("remove", { name: ts("favorites") })} />}
              {picked.map((tg) => <Chip key={tg} label={tg} onRemove={() => toggleTag(tg)} removeLabel={ts("remove", { name: tg })} />)}
              {min && <Chip label={`≥ ${min} ${currency}`} onRemove={() => setMin("")} removeLabel={ts("remove", { name: ts("priceMin") })} />}
              {max && <Chip label={`≤ ${max} ${currency}`} onRemove={() => setMax("")} removeLabel={ts("remove", { name: ts("priceMax") })} />}
              <button type="button" onClick={clearAll} className="px-1 text-sm font-semibold text-primary">{ts("clear")}</button>
            </div>
          )}

          {list.length === 0 ? (
            <div className="card space-y-3 p-10 text-center text-muted">
              <p>{ts("noResults")}</p>
              {anything && <button type="button" onClick={clearAll} className="btn-secondary">{ts("clear")}</button>}
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
              {list.map((p) => <Tile key={p.id} p={p} fav={favs.includes(p.id)} onFav={() => toggleFav(p.id)} />)}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {list.map((p) => <Row key={p.id} p={p} fav={favs.includes(p.id)} onFav={() => toggleFav(p.id)} />)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Chip({ label, onRemove, removeLabel }: { label: string; onRemove: () => void; removeLabel: string }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-1 rounded-full border border-primary/40 bg-primary-soft py-1 pl-3 pr-1 text-sm font-semibold text-primary">
      {label}
      <button type="button" onClick={onRemove} aria-label={removeLabel} className="grid h-7 w-7 place-items-center rounded-full hover:bg-primary/15">
        <CloseIcon width={14} height={14} />
      </button>
    </span>
  );
}

function FavButton({ fav, onFav, small = false }: { fav: boolean; onFav: () => void; small?: boolean }) {
  const ts = useTranslations("store");
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onFav();
      }}
      aria-pressed={fav}
      aria-label={fav ? ts("unfavorite") : ts("favorite")}
      className={`absolute left-1.5 top-1.5 grid place-items-center rounded-lg bg-[#060b1a]/55 backdrop-blur transition-transform active:scale-90 ${small ? "h-8 w-8 text-base" : "h-9 w-9 text-lg"} ${fav ? "text-[#ffc53d]" : "text-white"}`}
    >
      {fav ? "★" : "☆"}
    </button>
  );
}

function Delivery({ p }: { p: StoreProduct }) {
  const tp = useTranslations("product");
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-muted">
      {p.instant ? <><BoltIcon width={13} height={13} className="text-success" /> {tp("instant")}</> : p.delivery}
    </p>
  );
}

function Tile({ p, fav, onFav }: { p: StoreProduct; fav: boolean; onFav: () => void }) {
  const tc = useTranslations("common");
  const tp = useTranslations("product");
  return (
    <Link href={`/products/${p.slug}`} className="card lift group flex flex-col bg-[linear-gradient(180deg,var(--surface-2),var(--surface))] p-3">
      <div className="relative">
        <ProductArt name={p.name} accent={p.accent} image={p.image} />
        {p.tags[0] && <span className="badge absolute right-2 top-2 block max-w-[calc(100%-3.5rem)] truncate bg-[#060b1a]/60 text-[11px] text-white backdrop-blur">{p.tags.slice(0, 2).join(" · ")}</span>}
        {p.onSale && <span className="badge absolute bottom-2 left-2 bg-danger text-white">−%</span>}
        <FavButton fav={fav} onFav={onFav} />
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
        <h3 className="line-clamp-2 font-semibold leading-snug">{p.name}</h3>
        <Delivery p={p} />
        <div className="mt-auto flex flex-col gap-2.5 pt-3">
          <p className="text-sm">
            <span className="text-muted">{tc("from")} </span>
            <Price htg={p.price} className="font-bold text-text" />
          </p>
          {p.soldOut ? (
            <span className="flex min-h-10 w-full items-center justify-center rounded-xl bg-surface-2 px-3 text-sm font-bold text-danger">{tp("soldOut")}</span>
          ) : (
            <span className="flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 text-sm font-bold text-white transition-colors group-hover:bg-primary-hover">{tc("choose")}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function Row({ p, fav, onFav }: { p: StoreProduct; fav: boolean; onFav: () => void }) {
  const tc = useTranslations("common");
  const tp = useTranslations("product");
  return (
    <Link href={`/products/${p.slug}`} className="card lift group flex items-center gap-3 bg-[linear-gradient(90deg,var(--surface-2),var(--surface))] p-2.5 sm:gap-4 sm:p-3">
      <div className="relative w-24 shrink-0 sm:w-36">
        <ProductArt name={p.name} accent={p.accent} image={p.image} />
        <FavButton fav={fav} onFav={onFav} small />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="line-clamp-2 font-semibold leading-snug">{p.name}</h3>
        <Delivery p={p} />
        {p.tags[0] && <span className="mt-1.5 self-start rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">{p.tags.slice(0, 3).join(" · ")}</span>}
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-sm">
            <span className="text-muted">{tc("from")} </span>
            <Price htg={p.price} className="font-bold text-text" />
            {p.onSale && <span className="badge ml-1.5 bg-danger text-white">−%</span>}
          </p>
          {p.soldOut ? (
            <span className="inline-flex min-h-9 shrink-0 items-center rounded-xl bg-surface-2 px-3 text-xs font-bold text-danger">{tp("soldOut")}</span>
          ) : (
            <span className="inline-flex min-h-9 shrink-0 items-center rounded-xl bg-primary px-3 text-xs font-bold text-white transition-colors group-hover:bg-primary-hover">{tc("choose")}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
