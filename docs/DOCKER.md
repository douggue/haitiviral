# HaitiViral on your own VPS (Docker)

One script sets everything up: the site, the database, HTTPS for your domain, the order checks every 5 minutes and nightly backups.

## What you need
- A VPS with **Ubuntu 24.04**, at least **2 GB of memory**, in a US East location (closest to Haiti). For example DigitalOcean, Vultr or Hetzner.
- Your domain (e.g. `haitiviral.com`).

## 1. Point the domain to the VPS
At the company where you bought the domain, add two **A records** with the VPS's IP address:
- `haitiviral.com` → IP
- `www` → IP

It can take a few minutes to an hour to work.

## 2. Run the setup script
Log in to the VPS as root (SSH), then paste:

```
curl -fsSL https://raw.githubusercontent.com/douggue/haitiviral/main/install.sh | bash
```

It asks for one thing: your domain. Then it does the rest by itself:
- installs Docker
- downloads the site to `/opt/haitiviral`
- creates all the secret keys (saved in `/opt/haitiviral/.env`)
- opens only the needed ports (SSH, 80, 443)
- builds and starts everything. The first time takes 5–10 minutes.

At the end it shows your **admin setup address** and a **setup code**.

## 3. Right after
1. **Save the keys:** copy `/opt/haitiviral/.env` into your password manager. It holds `ENCRYPTION_KEY`; if it's lost, every provider key saved in the admin has to be typed again.
2. **Create your admin:** open `https://yourdomain/admin/setup`, type the setup code, then set up the authenticator app.
3. Follow "Before real customers" in `docs/DEPLOY.md` (Step 7): settings, provider, a real test order.

## Updating after a "ship it"
```
bash /opt/haitiviral/update.sh
```
It saves a database copy first, downloads the new version, rebuilds and restarts. The site pauses for a few seconds.

## Adding a key later (email, MonCash, Turnstile…)
1. Edit the file: `nano /opt/haitiviral/.env`, fill in the line, save.
2. Restart: `cd /opt/haitiviral && docker compose up -d --build`

## Backups
- Every night, a copy of the database and of the uploaded files goes to `/opt/haitiviral/backups`. Copies are kept 14 days.
- **Also copy that folder off the server** regularly (to your computer or a storage service). If the VPS is lost, a backup that was only on it is lost too.

## Useful commands (in `/opt/haitiviral`)
| What | Command |
|---|---|
| Is everything running? | `docker compose ps` |
| Site messages / errors | `docker compose logs app --tail 50` |
| Did the 5-minute job run? | `docker compose logs cron --tail 5` |
| Restart everything | `docker compose restart` |
| Stop everything | `docker compose down` (data is kept) |

## Restoring a backup (only if something went wrong)
```
cd /opt/haitiviral
docker compose stop app cron
docker compose exec -T db pg_restore -U haitiviral -d haitiviral --clean --if-exists < backups/db_YYYY-MM-DD_HHMM.dump
docker compose start app cron
```
