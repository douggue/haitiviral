#!/usr/bin/env bash
# HaitiViral: one-time setup on a fresh Ubuntu / Debian VPS. Run as root:
#   curl -fsSL https://raw.githubusercontent.com/douggue/haitiviral/main/install.sh | bash
# It installs Docker, downloads the site to /opt/haitiviral, asks for your domain, makes all the secret keys
# itself (saved in /opt/haitiviral/.env), and starts: site + database + HTTPS + 5-minute order checks + nightly backups.
# Safe to run again: it keeps your .env and data, and just updates and restarts.
set -euo pipefail

REPO="https://github.com/douggue/haitiviral.git"
DIR="/opt/haitiviral"

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run this as root (or put sudo before bash)."
command -v apt-get >/dev/null || die "This script is for Ubuntu or Debian."

say "Installing the basics (git, curl, openssl)"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git curl openssl ca-certificates >/dev/null

if ! command -v docker >/dev/null; then
  say "Installing Docker"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true

# Building the site needs about 2 GB of memory: add swap on small servers.
mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$mem_mb" -lt 3000 ] && [ "$(swapon --show | wc -l)" -eq 0 ]; then
  say "Adding 2 GB of swap (the server has ${mem_mb} MB of memory)"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if [ -d "$DIR/.git" ]; then
  say "Updating the code in $DIR"
  git -C "$DIR" pull --ff-only
else
  say "Downloading the code to $DIR"
  git clone --depth 50 "$REPO" "$DIR"
fi
cd "$DIR"

if [ ! -f .env ]; then
  say "First setup"
  domain=""
  while [ -z "$domain" ]; do
    printf 'Your domain (example: haitiviral.com): ' > /dev/tty
    read -r domain < /dev/tty
    domain=$(echo "$domain" | sed -E 's#^https?://##; s#/.*$##; s/^www\.//' | tr 'A-Z' 'a-z')
  done
  key() { openssl rand -hex 32; }
  cp .env.docker.example .env
  sed -i \
    -e "s|^DOMAIN=.*|DOMAIN=$domain|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(key)|" \
    -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(key)|" \
    -e "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(openssl rand -base64 32)|" \
    -e "s|^CRON_SECRET=.*|CRON_SECRET=$(key)|" \
    -e "s|^EMAIL_FROM=.*|EMAIL_FROM=HaitiViral <noreply@$domain>|" \
    .env
  chmod 600 .env
  echo "Secret keys created and saved in $DIR/.env"
fi
domain=$(grep '^DOMAIN=' .env | cut -d= -f2)

if command -v ufw >/dev/null; then
  say "Firewall: only SSH, web (80) and HTTPS (443) open"
  ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null
  ufw --force enable >/dev/null
fi

ip=$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
dns=$(getent ahostsv4 "$domain" 2>/dev/null | awk 'NR==1 {print $1}' || true)
if [ "$dns" != "$ip" ]; then
  printf '\n\033[1;33m⚠ %s does not point to this server yet (%s → %s).\033[0m\n' "$domain" "$domain" "${dns:-nothing}"
  echo "  At your domain seller, add an A record: $domain → $ip  (and www → $ip)."
  echo "  The site starts anyway; HTTPS works a few minutes after the domain points here."
fi

mkdir -p backups && chmod 700 backups

say "Building and starting (the first time takes 5–10 minutes)"
docker compose up -d --build
docker image prune -f >/dev/null

say "Waiting for the site"
for _ in $(seq 1 60); do
  if docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then ok=1; break; fi
  sleep 5
done
[ "${ok:-0}" = 1 ] || die "The site did not start. See what happened with:  cd $DIR && docker compose logs app --tail 50"

cron=$(grep '^CRON_SECRET=' .env | cut -d= -f2)
cat <<EOF

$(printf '\033[1;32m')✔ HaitiViral is running.$(printf '\033[0m')

  Site:          https://$domain
  First admin:   https://$domain/admin/setup
  Setup code:    $cron
                 (works once, only until the first admin exists)

  IMPORTANT: copy $DIR/.env to your password manager now.
  It holds ENCRYPTION_KEY: if it is lost, every provider key in the admin must be typed again.

  Update to the latest version later:   bash $DIR/update.sh
  Nightly backups:                       $DIR/backups  (copy them off the server too)
EOF
