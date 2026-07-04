#!/bin/sh
# Encrypted backup of the sovereign instance: Postgres database + the
# installed-skills volume (marketplace .skill installs; built-in skills are
# baked into the image and need no backup).
#
#   ./backup.sh [output-dir]          (default ./backups)
#
# Encryption: set BACKUP_PASSPHRASE in .env (openssl AES-256, streaming).
# Off-machine push: set BACKUP_RCLONE_REMOTE (e.g. "b2:nel-backups") and the
# script pushes the artifacts after writing them; any rclone remote works —
# the artifacts are encrypted before they leave the machine.
#
# Cloud/local sync model (README "Sync & travel replica"): LOCAL IS PRIMARY.
# A travel/cloud replica is this same compose stack elsewhere, restored from
# these backups with restore.sh. Never run both sides actively at once.
set -eu
cd "$(dirname "$0")"

# .env is a docker-compose env file, not a shell script — unquoted values
# may contain spaces (e.g. NEXT_PUBLIC_BRAND_NAME=DPO Central), so it must
# never be sourced. Extract only the keys this script needs.
env_get() { { [ -f .env ] && sed -n "s/^$1=//p" .env | tail -1; } || true; }
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-$(env_get BACKUP_PASSPHRASE)}"
BACKUP_RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-$(env_get BACKUP_RCLONE_REMOTE)}"
export BACKUP_PASSPHRASE
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE in deploy/sovereign/.env}"

OUT="${1:-./backups}"
mkdir -p "$OUT"
STAMP=$(date +%Y%m%d-%H%M%S)
DB_FILE="$OUT/dealroom-db-$STAMP.sql.gz.enc"
SKILLS_FILE="$OUT/dealroom-skills-$STAMP.tar.gz.enc"

echo "[backup] database → $DB_FILE"
docker compose exec -T db pg_dump -U dealroom dealroom \
  | gzip \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -out "$DB_FILE"

echo "[backup] installed skills → $SKILLS_FILE"
docker compose exec -T app tar -cz -C /app/data/skills installed \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -out "$SKILLS_FILE"

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  echo "[backup] pushing to $BACKUP_RCLONE_REMOTE"
  rclone copy "$DB_FILE" "$BACKUP_RCLONE_REMOTE/"
  rclone copy "$SKILLS_FILE" "$BACKUP_RCLONE_REMOTE/"
fi

# Retention: keep the newest 14 of each locally.
ls -1t "$OUT"/dealroom-db-*.enc 2>/dev/null | tail -n +15 | xargs rm -f 2>/dev/null || true
ls -1t "$OUT"/dealroom-skills-*.enc 2>/dev/null | tail -n +15 | xargs rm -f 2>/dev/null || true

echo "[backup] done: $(du -h "$DB_FILE" | cut -f1) db, $(du -h "$SKILLS_FILE" | cut -f1) skills"
