# Next changes (noted with the owner, not built yet)

Status: **noted only**. Nothing here is built. The owner decides the order before work starts; changes go to the preview branch and reach `main` after "ship it".

1. **Clean the admin.**
   - Remove what an SMM panel doesn't need, and every Haiti Gaming leftover: `hg_` names, gift-card and game wording.
   - Keep Code inventory, adapted to deliver accounts.
2. **Sell accounts.**
   - To decide: which categories, warranty and replacement, own-risk consent.
   - Unblock "account sale" in the risk rules for this section only.
3. **Accounts provider: YTSeller** (`https://ytseller.com/api/v2`, same style as SMM API v2).
   - **Catalog:** Gmail, YouTube channels, Facebook, Apple ID, Discord, Instagram, X, TikTok, Reddit…, $0.27–$110 each.
   - **API actions:** `products`, `add_product_order` (with `trans_id` = our reference, so a resend never buys twice), `product_order_status`, `result_product` (delivered lines), `balance`.
   - **Pricing and stock:** a per-piece price (not per 1,000); stock and sold-out synced.
   - **Delivery:** login details stored encrypted; "Instant" vs "Within 24h"; ask the customer for any `require` field.
   - **Customer help:** a 2FA code tool on the order page, and a Kreyòl/French first-steps guide (change the password and recovery email, turn on 2FA).
   - **Still to get:** their warranty terms in writing (their warranty page is still a template).
4. **SMS verification numbers (YTSeller).** US numbers for Gmail ($0.44), Discord ($0.09), Telegram ($0.33) and Instagram ($0.09): reusable, expire after a few months, no warranty.
   - Show the codes on our own order page; hide the YTSeller link if it can be read automatically.
   - A clear no-warranty warning and consent.
   - A minimum price in HTG.
5. **Service descriptions.**
   - A short Kreyòl/French text per choice, pre-filled from the provider and editable.
   - Automatic warnings per kind of service: public profile, speed can change, don't change your username.
   - Block a second order on the same link and service while one is running.
   - Never show the provider's service number or name.
6. **Smarter link check** (the basic profile-vs-video check already works).
   - Follow short links (vm.tiktok.com, youtu.be, fb.watch).
   - Instagram reel vs photo; YouTube video vs Shorts, per service.
   - Accept "@username" for followers.
   - Live-link check.
   - A "my account is public" checkbox.
7. **Easier service import.**
   - Pick from search cards instead of typing numbers, with smart suggestions per tier (Bon mache / Pi bon kalite / Rapid).
   - Compare providers side by side.
   - A suggested price (cost + target profit) on the same screen.
   - Create a new service in one go.
   - Change alerts after each Sync.
8. **Starter packs done right.**
   - **Price:** contents − pack discount, with a true "was" price.
   - **Links:** one profile link, plus video links one per line. Likes and views are spread evenly; the max number of videos comes from the provider minimums and an admin cap; every video is checked to be from the same account.
   - **Delivery:** automatic provider orders per video, with per-part refunds; one "My orders" card with a line per video.
   - **Admin:** packs built in the admin, with an optional "new customers only" limit.
9. **Currency.** Amount first, then HTG (e.g. `1,250 HTG`) everywhere: customer screens, notifications, emails, admin. Never "G".
10. **Referral program.** Mockups: `docs/mockup/ReferralVisitor.dc.html` (public page) and `docs/mockup/Referral.dc.html` (customer page).
    - **Commission:** a % per order of direct friends only (no multi-level).
    - **Earnings balance:** separate from the wallet, the only money that can be withdrawn. Commissions are held until the order is completed + 3 days, and canceled on refund.
    - **Withdrawals:** to MonCash/NatCash, to the number in the account (same name), approved by staff, paid within 24 h. Or moved into the wallet straight away.
    - **Minimum payout (required):**
      - Set in the admin (decided: **1,000 HTG**), and shown on both referral pages and in the withdrawal panel.
      - The "Retire lajan" (withdraw) button stays off below it, with "X HTG ankò pou w ka retire" (X HTG more before you can withdraw).
      - Optionally a different minimum for MonCash and NatCash, if their transfer fees differ.
      - No minimum for moving earnings into the wallet.
    - **Tiers** over the last 30 days:

      | Tier | To reach it | Commission |
      |---|---|---|
      | Bwonz | from the start | 5% |
      | Ajan | 5 active friends or 10,000 HTG | 7% |
      | Lò | 20 active friends or 50,000 HTG | 10% |
      | Dyaman | 50 active friends or 150,000 HTG | 12% |

    - **Anti-cheat:** the free-trial checks (same phone, device, IP).
    - **Profit check:** the highest tier is counted in Pricing & profit.
    - **To confirm:** the percentages, the hold, the payout time. (Minimum payout decided: 1,000 HTG.)
11. **Dark theme for the customer app.**
    - Today a dark mode exists underneath (from the old foundations: a `hg_theme` switch, dark colors), but the new screens built from the mockup use fixed light colors (white cards, light grey backgrounds) in about 14 files, so they would look broken in dark.
    - **Switch** in Kont (Account): Klè / Fonse / Otomatik (follows the phone). Remembered per person; light stays the default.
    - **Every screen checked in dark:** home, new order (including risk colors and the "?" sheets), my orders (progress colors), wallet, referral, trial, help, notifications, login.
    - **Installed app (PWA):** status bar and splash color follow the theme.
    - **Optional:** add dark versions of a few screens to the mockup first, to agree on the look.
12. **Real MonCash and NatCash logos everywhere.**
    - The real logos came with the Haiti Gaming foundations (`public/brand/moncash.webp`, `public/brand/natcash.webp`, `PayLogo` component), but only the old checkout and guide pages use them.
    - The new screens show red "MC" / orange "NC" letter tiles or text labels instead: Wallet (top-up picker), referral pages, the withdrawal panel, home.
    - Use the real logos on every screen where a payment method appears, including the bank-transfer logo set in Admin → Payment methods.
    - Keep them sharp and readable in dark theme (#11): a white rounded background behind each logo.

## Waiting on preview (not on `main` yet)
- One Private Blob store for every upload (public images served through `/media/…`).
- `docs/DEPLOY.md` updated: Private Blob, the 5-minute order check with cron-job.org, SMM steps.
