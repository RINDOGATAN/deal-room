#!/bin/sh
# Restore a sovereign instance from backup.sh artifacts — used both for
# disaster recovery and to seed the travel/cloud replica.
#
#   ./restore.sh <db-backup.sql.gz.enc> [skills-backup.tar.gz.enc]
#
# DESTRUCTIVE for the target instance: wipes its volumes, then restores.
# Run on a FRESH or intentionally-replaced deployment only.
# Requires BACKUP_PASSPHRASE in .env (same one that encrypted the artifacts).
set -eu
cd "$(dirname "$0")"

DB_BK="${1:?usage: restore.sh <db.sql.gz.enc> [skills.tar.gz.enc]}"
SKILLS_BK="${2:-}"
# .env is a docker-compose env file, not a shell script — unquoted values
# may contain spaces (e.g. NEXT_PUBLIC_BRAND_NAME=DPO Central), so it must
# never be sourced. Extract only the keys this script needs.
env_get() { { [ -f .env ] && sed -n "s/^$1=//p" .env | tail -1; } || true; }
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-$(env_get BACKUP_PASSPHRASE)}"
BACKUP_RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-$(env_get BACKUP_RCLONE_REMOTE)}"
export BACKUP_PASSPHRASE
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE in deploy/sovereign/.env}"

printf 'This WIPES the current instance and restores from backup. Type RESTORE to continue: '
read -r answer
[ "$answer" = "RESTORE" ] || { echo "aborted"; exit 1; }

echo "[restore] stopping stack, dropping volumes…"
docker compose down -v

echo "[restore] starting db only…"
docker compose up -d db
until docker compose exec -T db pg_isready -U dealroom >/dev/null 2>&1; do sleep 2; done

echo "[restore] loading database…"
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$DB_BK" \
  | gunzip \
  | docker compose exec -T db psql -U dealroom -d dealroom -f - >/dev/null

echo "[restore] starting the full stack…"
# The migrator sees existing users in the restored DB and skips the seed.
docker compose up -d

if [ -n "$SKILLS_BK" ]; then
  echo "[restore] loading installed skills…"
  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$SKILLS_BK" \
    | docker compose exec -T app tar -xz -C /app/data/skills
fi

echo "[restore] done. Verify: sign in, open /deals."
