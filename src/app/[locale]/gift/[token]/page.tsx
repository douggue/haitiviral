import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { revealCode } from "@/lib/orders";
import { audit } from "@/lib/audit";
import { t } from "@/lib/text";
import { GiftReveal } from "@/components/GiftReveal";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Private gift page: the link the buyer sent on WhatsApp. No account needed; codes hidden until "Show". */
export default async function GiftPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  if (!/^[A-Za-z0-9_-]{30,40}$/.test(token)) notFound();
  const order = await prisma.order.findUnique({
    where: { giftToken: token },
    select: { id: true, status: true, recipientNote: true, user: { select: { name: true } }, items: { select: { id: true, productName: true, variantName: true, codes: { select: { codeEncrypted: true } } } } },
  });
  if (!order || order.status !== "FULFILLED") notFound();
  const tg = await getTranslations("gift");
  const from = order.user.name.trim().split(/\s+/)[0] || "Haiti Gaming";
  const items = order.items.map((i) => ({ id: i.id, title: `${t(i.productName, locale)} — ${t(i.variantName, locale)}`, codes: i.codes.map((c) => revealCode(c.codeEncrypted)) }));
  await audit(null, "code.view.gift", "Order", order.id, { codes: items.reduce((n, i) => n + i.codes.length, 0) });

  return (
    <div className="container-page max-w-lg py-10">
      <div className="card overflow-hidden">
        <div className="bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--primary)_35%,transparent),transparent_70%)] px-6 pb-6 pt-10 text-center">
          <p className="text-5xl" aria-hidden>🎁</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{tg("pageTitle", { name: from })}</h1>
          {order.recipientNote && <p className="mx-auto mt-4 max-w-sm whitespace-pre-wrap rounded-2xl bg-surface-2 px-5 py-4 text-lg italic">“{order.recipientNote}”</p>}
        </div>
        <div className="space-y-4 p-6">
          {items.map((i) => (
            <GiftReveal key={i.id} title={i.title} codes={i.codes} />
          ))}
          <p className="text-xs text-muted">{tg("privateNote")}</p>
        </div>
      </div>
      <p className="mt-6 text-center text-sm">
        <Link href="/store" className="font-semibold text-primary">{tg("shopToo")} →</Link>
      </p>
    </div>
  );
}
