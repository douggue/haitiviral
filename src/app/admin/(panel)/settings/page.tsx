import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { moncashMode } from "@/lib/payments/moncash";
import { saveSettings } from "@/actions/admin";
import { ActionForm } from "@/components/admin/ActionButton";
import { PageTitle } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/ImageField";

export const metadata = { title: "Settings" };

const m = (n: number) => (n / 100).toFixed(2);

function Field({ name, label, value, hint, type = "text" }: { name: string; label: string; value: string | number; hint?: string; type?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input name={name} defaultValue={value} type={type} className="input" inputMode={type === "text" ? undefined : "decimal"} />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export default async function SettingsPage() {
  await requireStaff("settings.manage");
  const s = await getSettings();
  let mode = "mock";
  try {
    mode = moncashMode();
  } catch {
    mode = "not configured";
  }
  return (
    <>
      <PageTitle title="Settings" />
      <ActionForm action={saveSettings} className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Brand images</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <ImageField name="logoUrl" label="Logo (light background)" value={s.logoUrl} folder="brand" aspect="aspect-[3/1]" hint="Wide PNG or WebP with transparent background, about 600×200 px. Empty = built-in logo." />
            <ImageField name="logoDarkUrl" label="Logo for dark mode (optional)" value={s.logoDarkUrl} folder="brand" aspect="aspect-[3/1]" hint="A light version of the logo. Empty = same as above." />
            <ImageField name="heroImageUrl" label="Homepage hero image" value={s.heroImageUrl} folder="brand" hint="Shown beside the headline, about 1200×900 px. Empty = wallet illustration." />
            <ImageField name="ogImageUrl" label="Social share image" value={s.ogImageUrl} folder="brand" aspect="aspect-[1200/630]" hint="1200×630 px. Shown when the site is shared on WhatsApp or Facebook." />
          </div>
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Exchange rate & wallet</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field name="htgPerUsd" label="HTG per 1 USD (mid rate)" value={s.htgPerUsd} type="number" hint="Used for USD prices and exchange." />
            <Field name="exchangeSpreadBps" label="Exchange spread (basis points)" value={s.exchangeSpreadBps} type="number" hint="150 = 1.5% against the customer." />
            <Field name="exchangeFeeBps" label="Exchange fee (basis points)" value={s.exchangeFeeBps} type="number" />
            <Field name="exchangeQuoteSeconds" label="Quote validity (seconds)" value={s.exchangeQuoteSeconds} type="number" />
            <Field name="minDepositHtg" label="Minimum deposit (HTG)" value={m(s.minDepositHtg)} />
            <Field name="maxDepositHtg" label="Maximum deposit (HTG)" value={m(s.maxDepositHtg)} />
          </div>
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Fraud controls</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field name="holdThresholdHtg" label="Hold NatCash deposits from (HTG)" value={m(s.holdThresholdHtg)} />
            <Field name="holdHours" label="Hold period (hours)" value={s.holdHours} type="number" />
            <Field name="newAccountDays" label="New account period (days)" value={s.newAccountDays} type="number" />
            <Field name="newAccountDailyLimitHtg" label="New account daily limit (HTG)" value={m(s.newAccountDailyLimitHtg)} />
            <Field name="maxAccountsPerDevice" label="Flag new accounts on a browser already used by" value={s.maxAccountsPerDevice} type="number" hint="Number of other accounts. Flags go to the risk queue." />
            <Field name="reviewOrderThresholdHtg" label="Review orders from (HTG)" value={m(s.reviewOrderThresholdHtg)} hint="Codes are released only after a staff review." />
            <Field name="approvalThresholdHtg" label="Second approval for wallet adjustments from (HTG)" value={m(s.approvalThresholdHtg)} hint="Another staff member must approve." />
            <Field name="autoRefundHours" label="Auto-refund undelivered orders after (hours)" value={s.autoRefundHours} type="number" hint="0 = off. Runs with the scheduled job." />
          </div>
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Referral program</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="referralEnabled" defaultChecked={s.referralEnabled} /> Referral program on</label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="requireEmailVerification" defaultChecked={s.requireEmailVerification} className="mt-1" />
            <span>Require email confirmation before buying, depositing or exchanging. <span className="text-muted">Customers can still browse, fill their cart and contact support. Turns itself off while email sending is off.</span></span>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="newsletterEnabled" defaultChecked={s.newsletterEnabled} /> Newsletter sign-up form in the footer (subscribers are listed in Admin → Newsletter)</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="referralRewardHtg" label="Reward to the referrer (HTG, store credit)" value={m(s.referralRewardHtg)} />
            <Field name="referralMinOrderHtg" label="Friend's first order must be at least (HTG)" value={m(s.referralMinOrderHtg)} />
          </div>
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Payment methods</h2>
          <p className="text-sm text-muted">MonCash adapter mode: <b>{mode}</b>. Credentials are set as environment variables (MONCASH_CLIENT_ID / MONCASH_CLIENT_SECRET / MONCASH_MODE), never in the database.</p>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="moncashEnabled" defaultChecked={s.moncashEnabled} /> MonCash enabled</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="natcashEnabled" defaultChecked={s.natcashEnabled} /> NatCash enabled</label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="natcashRecipientName" label="NatCash recipient name" value={s.natcashRecipientName} />
            <Field name="natcashRecipientPhone" label="NatCash recipient number" value={s.natcashRecipientPhone} />
          </div>
          <div className="max-w-xs">
            <ImageField name="natcashQrUrl" label="NatCash QR code (optional)" value={s.natcashQrUrl} folder="brand" aspect="aspect-square" hint="Screenshot of your NatCash merchant QR. Customers scan it on the deposit page. Empty = number only." />
          </div>
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Business & support</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="businessName" label="Registered business name" value={s.businessName} />
            <Field name="businessAddress" label="Address" value={s.businessAddress} />
            <Field name="whatsappNumber" label="WhatsApp number (digits, with 509)" value={s.whatsappNumber} />
            <Field name="supportHours" label="Support hours" value={s.supportHours} />
            <Field name="socialFacebook" label="Facebook URL" value={s.socialFacebook} />
            <Field name="socialInstagram" label="Instagram URL" value={s.socialInstagram} />
            <Field name="socialTiktok" label="TikTok URL" value={s.socialTiktok} />
          </div>
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Announcement bar</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="announcementEnabled" defaultChecked={s.announcement.enabled} /> Show announcement</label>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["ht", "fr", "en", "es"] as const).map((l) => <Field key={l} name={`announcement_${l}`} label={`Text (${l.toUpperCase()})`} value={s.announcement.text[l] ?? ""} />)}
            <Field name="announcementLink" label="Link (optional)" value={s.announcement.link} />
            <Field name="announcementStartsAt" label="Show from (optional)" value={s.announcement.startsAt ?? ""} type="datetime-local" />
            <Field name="announcementEndsAt" label="Hide after (optional)" value={s.announcement.endsAt ?? ""} type="datetime-local" />
          </div>
        </section>
        <button className="btn-primary">Save settings</button>
      </ActionForm>
    </>
  );
}
