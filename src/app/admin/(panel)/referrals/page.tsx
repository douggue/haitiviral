import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { decideReferral } from "@/actions/admin";
import { ActionButton } from "@/components/admin/ActionButton";
import { PageTitle, Table } from "@/components/admin/ui";

export const metadata = { title: "Referrals" };

export default async function ReferralsAdmin() {
  await requireStaff("referrals.manage");
  const [s, list] = await Promise.all([
    getSettings(),
    prisma.referral.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { referrer: { select: { id: true, name: true } }, referred: { select: { id: true, name: true } } } }),
  ]);
  return (
    <>
      <PageTitle title="Referrals" sub={`${s.referralEnabled ? "Program on" : "Program off (Settings → Referral program)"} · reward ${formatMoney(s.referralRewardHtg, "HTG", "en")} after the friend's first delivered order of ${formatMoney(s.referralMinOrderHtg, "HTG", "en")}+. Same-network signups are rejected automatically.`} />
      <Table head={["Referrer", "Friend", "Status", "Note", "Date", ""]} empty={list.length === 0}>
        {list.map((r) => (
          <tr key={r.id}>
            <td className="px-4 py-3"><Link href={`/admin/customers/${r.referrer.id}`} className="text-primary">{r.referrer.name}</Link></td>
            <td className="px-4 py-3"><Link href={`/admin/customers/${r.referred.id}`} className="text-primary">{r.referred.name}</Link></td>
            <td className="px-4 py-3 text-xs font-semibold">{r.status}{r.rewardAmount ? ` · ${formatMoney(r.rewardAmount, "HTG", "en")}` : ""}</td>
            <td className="px-4 py-3 text-xs text-muted">{r.note ?? ""}</td>
            <td className="px-4 py-3 text-muted">{r.createdAt.toLocaleDateString("en-US")}</td>
            <td className="px-4 py-3">
              {r.status !== "REWARDED" && (
                <div className="flex gap-2">
                  <ActionButton label="Pay reward" confirm="Pay the referral reward now?" action={decideReferral.bind(null, r.id, "PAY")} />
                  {r.status === "PENDING" && <ActionButton label="Reject" className="btn-ghost min-h-9 px-3 text-xs text-danger" action={decideReferral.bind(null, r.id, "REJECT")} />}
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
