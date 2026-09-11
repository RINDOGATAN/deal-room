#!/usr/bin/env bash
# Fresh-versus-upgraded comparison for a release.
#
# Runs the published migrator twice: once against an empty database (what a new
# self-hoster gets) and once against a restored backup of an existing install
# (what an upgrading one gets). It then compares the two databases and reports
# every difference, so a release never ships an upgrade path that ends up
# somewhere a fresh install would not.
#
# It compares:
#   1. the schema (every column of every table),
#   2. the applied migration history,
#   3. row counts, table by table,
#   4. the skill catalog per contract type: clauses and options, live and
#      retired, and which skill package each template belongs to.
#
# Differences in a firm's own data (deals, users, audit logs) are expected and
# only reported. The check fails on a schema difference, a migration-history
# difference, or a catalog difference in a skill that both sides share.
#
# Usage:
#   scripts/upgrade-check.sh <backup-file> [options]
#
#   <backup-file>            pg_dump output: .sql, .sql.gz, or .sql.gz.enc
#                            (the encrypted form produced by the suite kit)
#
#   --version <vX.Y.Z>       migrator image tag to test (default: latest)
#   --image <image>          full migrator image instead of a tag, e.g. a
#                            locally built one, to check before tagging
#   --env-file <file>        file holding BACKUP_PASSPHRASE=... (the suite .env)
#   --keep                   leave the two databases running for inspection
#
# The passphrase for an encrypted backup is read from BACKUP_PASSPHRASE in the
# environment or from --env-file. It is never printed.

set -euo pipefail

BACKUP=""
VERSION="latest"
IMAGE=""
ENV_FILE=""
KEEP=0
PG_IMAGE="postgres:16-alpine"
NET="dealroom-upgrade-check"
FRESH="dealroom-upgrade-check-fresh"
UPGRADED="dealroom-upgrade-check-upgraded"
PGPASS="upgradecheck"

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --image) IMAGE="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) BACKUP="$1"; shift ;;
  esac
done

[ -n "$BACKUP" ] || { echo "Usage: scripts/upgrade-check.sh <backup-file> [--version vX.Y.Z | --image IMAGE]" >&2; exit 2; }
[ -f "$BACKUP" ] || { echo "Backup file not found: $BACKUP" >&2; exit 2; }
[ -n "$IMAGE" ] || IMAGE="ghcr.io/rindogatan/deal-room-migrator:${VERSION}"

WORK="$(mktemp -d)"
cleanup() {
  if [ "$KEEP" = "1" ]; then
    echo "Databases left running: $FRESH, $UPGRADED (docker rm -f to remove)."
  else
    docker rm -f "$FRESH" "$UPGRADED" >/dev/null 2>&1 || true
    docker network rm "$NET" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

say() { printf '%s\n' "$*"; }
hr() { printf '%s\n' "------------------------------------------------------------"; }

# ---------------------------------------------------------------- the databases
docker rm -f "$FRESH" "$UPGRADED" >/dev/null 2>&1 || true
docker network rm "$NET" >/dev/null 2>&1 || true
docker network create "$NET" >/dev/null

for name in "$FRESH" "$UPGRADED"; do
  docker run -d --name "$name" --network "$NET" \
    -e POSTGRES_USER=dealroom -e POSTGRES_PASSWORD="$PGPASS" -e POSTGRES_DB=dealroom \
    "$PG_IMAGE" >/dev/null
done

say "Waiting for both databases..."
for name in "$FRESH" "$UPGRADED"; do
  for _ in $(seq 1 60); do
    if docker exec "$name" pg_isready -U dealroom >/dev/null 2>&1; then break; fi
    sleep 1
  done
  docker exec "$name" pg_isready -U dealroom >/dev/null 2>&1 || { echo "Database $name did not start." >&2; exit 1; }
done

# ------------------------------------------------------------------ the restore
say "Restoring the backup into $UPGRADED..."
decrypt() {
  case "$BACKUP" in
    *.enc)
      if [ -z "${BACKUP_PASSPHRASE:-}" ] && [ -n "$ENV_FILE" ]; then
        BACKUP_PASSPHRASE="$(grep -E '^BACKUP_PASSPHRASE=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
      fi
      [ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "Encrypted backup needs BACKUP_PASSPHRASE (env or --env-file)." >&2; exit 2; }
      BACKUP_PASSPHRASE="$BACKUP_PASSPHRASE" openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$BACKUP"
      ;;
    *) cat "$BACKUP" ;;
  esac
}
uncompress() {
  case "${BACKUP%.enc}" in
    *.gz) gunzip ;;
    *) cat ;;
  esac
}
decrypt | uncompress | docker exec -i "$UPGRADED" psql -q -U dealroom -d dealroom >"$WORK/restore.log" 2>&1 || {
  echo "Restore failed. Last lines:" >&2; tail -20 "$WORK/restore.log" >&2; exit 1;
}

# ----------------------------------------------------------------- the migrator
say "Pulling $IMAGE..."
docker image inspect "$IMAGE" >/dev/null 2>&1 || docker pull "$IMAGE" >/dev/null

run_migrator() {
  local host="$1" label="$2"
  local url="postgresql://dealroom:${PGPASS}@${host}:5432/dealroom"
  say "Running the migrator against the $label database..."
  docker run --rm --network "$NET" -w /app \
    -e DATABASE_URL="$url" -e DATABASE_URL_UNPOOLED="$url" \
    --entrypoint /bin/sh "$IMAGE" deploy/sovereign/migrate.sh >"$WORK/migrate-$label.log" 2>&1 || {
    echo "The migrator failed on the $label database. Last lines:" >&2
    tail -30 "$WORK/migrate-$label.log" >&2
    exit 1
  }
}
run_migrator "$FRESH" fresh
run_migrator "$UPGRADED" upgraded

# ---------------------------------------------------------------- the questions
q() { docker exec -i "$1" psql -U dealroom -d dealroom -At -F'|' -c "$2"; }

SQL_SCHEMA="SELECT table_name||'.'||column_name||' '||data_type||' '||is_nullable
            FROM information_schema.columns WHERE table_schema='public' ORDER BY 1;"

SQL_MIGRATIONS="SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name;"

SQL_COUNTS="SELECT table_name, (xpath('/row/c/text()',
              query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint
            FROM information_schema.tables
            WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1;"

# Retirement columns exist from v0.1.33 on; an older migrator image under test
# produces a database without them, and the catalog query adapts.
HAS_RETIRED="$(q "$FRESH" "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='clause_templates' AND column_name='retiredAt';")"
if [ "$HAS_RETIRED" = "1" ]; then
  LIVE_C="count(c.id) FILTER (WHERE c.\"retiredAt\" IS NULL)"
  RETIRED_C="count(c.id) FILTER (WHERE c.\"retiredAt\" IS NOT NULL)"
  OPT_COUNTS="count(*) FILTER (WHERE \"retiredAt\" IS NULL) AS live, count(*) FILTER (WHERE \"retiredAt\" IS NOT NULL) AS retired"
else
  LIVE_C="count(c.id)"
  RETIRED_C="0"
  OPT_COUNTS="count(*) AS live, 0 AS retired"
fi

SQL_CATALOG="SELECT t.\"contractType\",
              CASE WHEN p.id IS NULL THEN 'built-in'
                   WHEN p.\"packageHash\" LIKE 'stub:%' THEN 'catalog stub'
                   ELSE 'installed package' END,
              ${LIVE_C}, ${RETIRED_C},
              coalesce(sum(o.live),0), coalesce(sum(o.retired),0)
            FROM contract_templates t
            LEFT JOIN skill_packages p ON p.id = t.\"skillPackageId\"
            LEFT JOIN clause_templates c ON c.\"contractTemplateId\" = t.id
            LEFT JOIN LATERAL (
              SELECT ${OPT_COUNTS}
              FROM clause_options WHERE \"clauseTemplateId\" = c.id) o ON true
            GROUP BY 1,2 ORDER BY 1;"

for pair in "schema:$SQL_SCHEMA" "migrations:$SQL_MIGRATIONS" "counts:$SQL_COUNTS" "catalog:$SQL_CATALOG"; do
  name="${pair%%:*}"; sql="${pair#*:}"
  q "$FRESH" "$sql" >"$WORK/$name.fresh"
  q "$UPGRADED" "$sql" >"$WORK/$name.upgraded"
done

# ------------------------------------------------------------------ the report
FAILURES=0

hr
say "SCHEMA"
if diff -u "$WORK/schema.fresh" "$WORK/schema.upgraded" >"$WORK/schema.diff"; then
  say "  identical ($(wc -l <"$WORK/schema.fresh" | tr -d ' ') columns)"
else
  say "  DIFFERENT — the upgrade path does not produce the schema a fresh install gets:"
  sed -n '3,40p' "$WORK/schema.diff" | sed 's/^/    /'
  FAILURES=$((FAILURES + 1))
fi

hr
say "MIGRATION HISTORY"
if diff -u "$WORK/migrations.fresh" "$WORK/migrations.upgraded" >"$WORK/migrations.diff"; then
  say "  identical ($(wc -l <"$WORK/migrations.fresh" | tr -d ' ') applied)"
else
  say "  DIFFERENT:"
  sed -n '3,40p' "$WORK/migrations.diff" | sed 's/^/    /'
  FAILURES=$((FAILURES + 1))
fi

hr
say "ROW COUNTS (fresh / upgraded)"
awk -F'|' '
  NR==FNR { fresh[$1]=$2; next }
  { up[$1]=$2 }
  END {
    for (t in fresh) if (!(t in up)) up[t]="-"
    for (t in up) if (!(t in fresh)) fresh[t]="-"
    n=0; for (t in up) names[n++]=t
    for (i=0;i<n;i++) for (j=i+1;j<n;j++) if (names[i]>names[j]) { tmp=names[i]; names[i]=names[j]; names[j]=tmp }
    for (i=0;i<n;i++) {
      t=names[i]
      mark = (fresh[t]==up[t]) ? "  " : "* "
      printf "  %s%-34s %10s %10s\n", mark, t, fresh[t], up[t]
    }
  }
' "$WORK/counts.fresh" "$WORK/counts.upgraded"
say "  (* = different; a firm's own data differs by nature — read it, do not fear it)"

hr
say "SKILL CATALOG (clauses live/retired, options live/retired)"
awk -F'|' '
  NR==FNR { f[$1]=$0; next }
  { u[$1]=$0 }
  END {
    n=0; for (t in f) if (!(t in seen)) { names[n++]=t; seen[t]=1 }
    for (t in u) if (!(t in seen)) { names[n++]=t; seen[t]=1 }
    for (i=0;i<n;i++) for (j=i+1;j<n;j++) if (names[i]>names[j]) { tmp=names[i]; names[i]=names[j]; names[j]=tmp }
    drift=0
    for (i=0;i<n;i++) {
      t=names[i]
      if (!(t in f)) { split(u[t],b,"|"); printf "  + %-28s only on the upgraded side (%s): %s clauses\n", t, b[2], b[3]
                       if (b[2] != "installed package") drift++
                       continue }
      if (!(t in u)) { split(f[t],a,"|"); printf "  - %-28s MISSING after upgrade (%s)\n", t, a[2]; drift++; continue }
      split(f[t],a,"|"); split(u[t],b,"|")
      same = (a[3]==b[3] && a[5]==b[5])
      mark = same ? "  " : (b[2]=="installed package" && a[2]=="catalog stub" ? "i " : "! ")
      if (mark=="! ") drift++
      printf "  %s%-28s fresh %s/%s clauses %s/%s options   upgraded %s/%s clauses %s/%s options\n", \
             mark, t, a[3], a[4], a[5], a[6], b[3], b[4], b[5], b[6]
    }
    printf "DRIFT=%d\n", drift
  }
' "$WORK/catalog.fresh" "$WORK/catalog.upgraded" >"$WORK/catalog.report"

grep -v '^DRIFT=' "$WORK/catalog.report"
CATALOG_DRIFT="$(sed -n 's/^DRIFT=//p' "$WORK/catalog.report")"
say "  (i = installed on this site only, expected; ! = differs and should not)"
[ "${CATALOG_DRIFT:-0}" = "0" ] || FAILURES=$((FAILURES + 1))

hr
if [ "$FAILURES" = "0" ]; then
  say "RESULT: the upgraded database matches a fresh install."
  exit 0
fi
say "RESULT: $FAILURES area(s) differ. Do not tag the release until each is explained."
exit 1
