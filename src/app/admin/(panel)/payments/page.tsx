import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { approvePayment, rejectPaymentAction } from "@/actions/admin";
import { ActionButton } from "@/components/admin/ActionButton";
import { PageTitle, Table } from "@/components/admin/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { formatPhone } from "@/lib/phone";
import { CopyButton } from "@/components/CopyButton";
import { haitiDate, methodLabel, statusLabel } from "@/lib/admin-labels";

export const metadata = { title: "Payments" };

/** Block explorer link so staff can check a crypto deposit before approving. */
function explorer(network: string | null, hash: string) {
  const n = (network ?? "").toLowerCase();
  const h = encodeURIComponent(hash);
  if (n.includes("bep") || n.includes("bsc")) return `https://bscscan.com/tx/${h}`;
  if (n.includes("polygon")) return `https://polygonscan.com/tx/${h}`;
  if (n.includes("trc") || n.includes("tron")) return `https://tronscan.org/#/transaction/${h.replace(/^0x/, "")}`;
  if (n.includes("erc") || n.includes("eth")) return `https://etherscan.io/tx/${h}`;
  return null;
}

export default async function AdminPayments() {
  await requireStaff("payments.review");
  const [queue, recent, settings] = await Promise.all([
    prisma.paymentIntent.findMany({
      where: { status: "REVIEW" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } }, order: { select: { number: true } }, manualMethod: { select: { code: true, recipientNumber: true, kind: true, network: true } } },
    }),
    prisma.paymentIntent.findMany({ where: { status: { not: "REVIEW" } }, orderBy: { updatedAt: "desc" }, take: 50, include: { user: { select: { name: true } }, reviewedBy: { select: { name: true } } } }),
    getSettings(),
  ]);
  return (
    <>
      <PageTitle title="Payments" sub={`NatCash recipient: ${settings.natcashRecipientName} · ${settings.natcashRecipientPhone}. Match every reference against the NatCash statement before approving.`} />
      <h2 className="mb-3 font-semibold">Review queue ({queue.length})</h2>
      <div className="space-y-3">
        {queue.length === 0 && <p className="card p-8 text-center text-sm text-muted">No payments waiting for review.</p>}
        {queue.map((p) => {
          const ageDays = Math.floor((Date.now() - p.user.createdAt.getTime()) / 86_400_000);
          return (
            <div key={p.id} className="card flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="space-y-1 text-sm">
                <p className="text-lg font-bold">{formatMoney(p.amount, p.currency, "en")} <span className="text-sm font-medium text-muted">via {p.manualMethod ? `${p.manualMethod.code} (${p.manualMethod.recipientNumber})` : p.provider}</span></p>
                <p className="flex flex-wrap items-center gap-2 break-all">{p.manualMethod?.kind === "crypto" ? "Transaction hash" : "Reference"}: <span className="font-mono font-bold">{p.providerRef}</span> {p.providerRef && <CopyButton value={p.providerRef} label="Copy" done="Copied" className="btn-ghost min-h-9 px-2 text-xs" />} {p.payerPhone && <>· from {formatPhone(p.payerPhone)}</>}</p>
                {p.manualMethod?.kind === "crypto" && p.providerRef && explorer(p.manualMethod.network, p.providerRef) && (
                  <a href={explorer(p.manualMethod.network, p.providerRef)!} target="_blank" rel="noreferrer" className="font-semibold text-primary">Check on the blockchain ({p.manualMethod.network}) ↗</a>
                )}
                <p className="text-muted">
                  <Link href={`/admin/customers/${p.user.id}`} className="text-primary">{p.user.name}</Link> ({p.user.email}) · account {ageDays} day(s) old
                </p>
                <p className="text-muted">{p.order ? <>For order <Link className="text-primary" href={`/admin/orders/${p.orderId}`}>#{p.order.number}</Link></> : "Wallet deposit"} · sent {haitiDate(p.createdAt)} (Haiti)</p>
                {p.evidencePath && (
                  <a href={`/api/admin/evidence/${p.id}`} target="_blank" className="mt-1 block w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/admin/evidence/${p.id}`} alt="Customer's payment screenshot (tap to enlarge)" className="max-h-56 rounded-lg border border-border" loading="lazy" />
                  </a>
                )}
                {!p.orderId && (p.currency === "USD" ? Math.round(p.amount * settings.htgPerUsd) : p.amount) >= settings.holdThresholdHtg && <p className="text-warning">Above hold threshold: funds will be held {settings.holdHours}h after approval.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton label={`Approve ${formatMoney(p.amount, p.currency, "en")}`} className="btn-primary min-h-11 px-4 text-sm" confirm={`Approve ${formatMoney(p.amount, p.currency, "en")} for ${p.user.name}? Only approve if the money is really there (statement or blockchain).`} action={approvePayment.bind(null, p.id)} />
                <ActionButton label="Another amount arrived…" className="btn-secondary min-h-11 px-4 text-sm" prompt={`Amount that really arrived (customer said ${formatMoney(p.amount, p.currency, "en")})`} action={approvePayment.bind(null, p.id, "Amount corrected by staff")} />
                <ActionButton label="Reject…" className="btn-danger min-h-11 px-4 text-sm" prompt="Reason the customer will read (Kreyòl), e.g. 'Nou pa jwenn peman sa a. Tcheke referans lan epi voye l ankò.'" action={rejectPaymentAction.bind(null, p.id)} />
              </div>
            </div>
          );
        })}
      </div>
      <h2 className="mb-3 mt-8 font-semibold">Recent payments</h2>
      <Table head={["Customer", "Provider", "Amount", "Reference", "Status", "Reviewed by", "Updated"]} empty={recent.length === 0}>
        {recent.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-3">{p.user.name}</td>
            <td className="px-4 py-3">{methodLabel(p.provider)}</td>
            <td className="px-4 py-3">{formatMoney(p.amount, p.currency, "en")}</td>
            <td className="px-4 py-3 font-mono text-xs">{p.providerRef?.split("~rejected~")[0] ?? "—"}</td>
            <td className="px-4 py-3"><StatusBadge status={p.status} label={statusLabel(p.status)} /></td>
            <td className="px-4 py-3">{p.reviewedBy?.name ?? (p.provider === "MONCASH" ? "Automatic" : "—")}</td>
            <td className="px-4 py-3 text-muted">{haitiDate(p.updatedAt)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
