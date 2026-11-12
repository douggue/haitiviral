#!/bin/sh
# Every night: database + uploaded files into /backups (./backups on the server). Copies older than 14 days are removed.
# Copy the ./backups folder somewhere off the server too (see docs/DOCKER.md).
# Only the owner of the files can read them (they hold customer data).
umask 077
chmod 700 /backups 2>/dev/null || true
while true; do
  d=$(date +%Y-%m-%d_%H%M)
  pg_dump -h db -U haitiviral -d haitiviral -Fc -f "/backups/db_$d.dump" && echo "database backup $d done"
  tar -czf "/backups/uploads_$d.tar.gz" -C /uploads . && echo "files backup $d done"
  find /backups -maxdepth 1 -type f \( -name 'db_*.dump' -o -name 'uploads_*.tar.gz' \) -mtime +14 -exec rm -f {} \;
  sleep 86400
done
