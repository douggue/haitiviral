#!/usr/bin/env bash
# HaitiViral: update the server to the latest version (after a "ship it"). Run as root:
#   bash /opt/haitiviral/update.sh
# Keeps your .env, database, uploads and backups. The database tables are updated when the site restarts.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "No .env here: run install.sh first."; exit 1; }

echo "==> Saving a database copy first"
umask 077
mkdir -p backups && chmod 700 backups
d=$(date +%Y-%m-%d_%H%M)
f="backups/before-update_$d.dump"
docker compose exec -T db pg_dump -U haitiviral -d haitiviral -Fc > "$f"
if [ ! -s "$f" ]; then echo "✖ The database copy is empty: update stopped, nothing was changed."; exit 1; fi
echo "    $f"

echo "==> Downloading the latest version"
git pull --ff-only

echo "==> Building and restarting (a few minutes; the site pauses for a few seconds at the switch)"
docker compose up -d --build
docker image prune -f >/dev/null

echo "==> Checking"
for _ in $(seq 1 60); do
  if docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "✔ Updated and running."
    exit 0
  fi
  sleep 5
done
echo "✖ The site did not come back. See:  docker compose logs app --tail 50"
exit 1
