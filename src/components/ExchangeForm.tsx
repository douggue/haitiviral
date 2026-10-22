"use client";
import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { confirmExchange, requestQuote } from "@/actions/wallet";
import { formatMoney } from "@/lib/money";
import { SwapIcon } from "./Icons";

type Quote = { id: string; from: string; to: string; fromAmount: number; toAmount: number; rate: number; fee: number; expiresAt: string };

export function ExchangeForm({ balances, midRate }: { balances: { HTG: number; USD: number }; midRate: number }) {
  const tw = useTranslations("wallet");
  const tc = useTranslations("common");
  const tco = useTranslations("checkout");
  const locale = useLocale();
  const router = useRouter();
  const [from, setFrom] = useState<"HTG" | "USD">("HTG");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [left, setLeft] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const to = from === "HTG" ? "USD" : "HTG";

  useEffect(() => {
    if (!quote) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(quote.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [quote]);

  const errText = (e: string) => (e === "insufficient" || e === "verify_email" ? tco(`errors.${e}`) : tw.has(e) ? tw(e as "quoteExpired") : tc("error"));

  return (
    <div className="card space-y-5 p-5 sm:p-6">
      <p className="text-sm text-muted">1 USD = {midRate.toLocaleString(locale)} HTG</p>
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div>
          <span className="label">{tw("from")}</span>
          <div className="rounded-xl border border-border p-3">
            <p className="text-lg font-bold">{from}</p>
            <p className="text-xs text-muted">{formatMoney(balances[from], from, locale)}</p>
          </div>
        </div>
        <button type="button" className="btn-secondary min-h-11 px-3" onClick={() => { setFrom(to); setQuote(null); }} aria-label="Swap">
          <SwapIcon />
        </button>
        <div>
          <span className="label">{tw("to")}</span>
          <div className="rounded-xl border border-border p-3">
            <p className="text-lg font-bold">{to}</p>
            <p className="text-xs text-muted">{formatMoney(balances[to], to, locale)}</p>
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="ex-amount" className="label">{tw("amount").replace("HTG", from)}</label>
        <input id="ex-amount" inputMode="decimal" className="input text-lg font-semibold" value={amount} onChange={(e) => { setAmount(e.target.value); setQuote(null); }} placeholder="0.00" />
      </div>

      {quote && left > 0 ? (
        <div className="space-y-2 rounded-xl bg-surface-2 p-4 text-sm">
          <div className="flex justify-between"><span className="text-muted">{tw("rate")}</span><span>1 USD = {quote.rate.toFixed(2)} HTG</span></div>
          <div className="flex justify-between"><span className="text-muted">{tw("fee")}</span><span>{formatMoney(quote.fee, quote.from as "HTG", locale)}</span></div>
          <div className="flex justify-between text-base font-bold"><span>{tw("youReceive")}</span><span>{formatMoney(quote.toAmount, quote.to as "HTG", locale)}</span></div>
          <p className="text-xs text-muted">{tw("quoteValid", { seconds: left })}</p>
          <button
            type="button"
            className="btn-primary mt-2 w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await confirmExchange(quote.id);
                setQuote(null);
                if (r.ok) {
                  setMsg({ ok: true, text: tw("exchanged") });
                  setAmount("");
                  router.refresh();
                } else setMsg({ ok: false, text: errText(r.error) });
              })
            }
          >
            {tw("confirmExchange")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn-primary w-full"
          disabled={pending || !amount}
          onClick={() =>
            start(async () => {
              setMsg(null);
              const r = await requestQuote(from, amount);
              if (r.ok) setQuote(r.quote);
              else setMsg({ ok: false, text: errText(r.error) });
            })
          }
        >
          {quote ? tw("quoteExpired") + " " : ""}{tw("getQuote")}
        </button>
      )}
      {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`} role="status">{msg.text}</p>}
    </div>
  );
}
