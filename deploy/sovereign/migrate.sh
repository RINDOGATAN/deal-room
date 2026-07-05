#!/bin/sh
# One-shot migrator for the sovereign bundle. Runs inside the builder image
# (prisma CLI + tsx + migrations + seed present). Safe to re-run any time:
#
#   docker compose run --rm migrator
#
# Schema: the repo's prisma/migrations was baselined against the cloud DB —
# the first migration ALTERs tables that an initial `db push` created, so it
# cannot bootstrap an empty database. Hence:
#   fresh DB     → prisma db push (full schema), then mark every migration
#                  as applied (baseline) so future `migrate deploy` works;
#   baselined DB → prisma migrate deploy (normal path after git pull).
# Recovery: baseline state is detected via Prisma's own _prisma_migrations
# table (not an app table), and a deploy that fails with P3005 ("schema is
# not empty" — tables exist but were never baselined, e.g. a previous run
# died between `db push` and the resolve loop) falls back to baselining and
# re-runs the deploy, so a half-initialized DB heals instead of blocking
# the app (compose gates app start on this service succeeding).
# Seed: skill catalog + supervisor + demo users — FIRST boot only; an
# instance that already has users is never re-seeded (the seed's upserts
# could otherwise clobber live edits to seeded rows).
set -eu
cd /app

table_exists() {
  node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRawUnsafe(\"SELECT to_regclass('public.$1')::text AS r\").then(rows=>process.exit(rows[0].r?0:1)).catch(()=>process.exit(1))"
}

# Mark every repo migration as applied, oldest first. Re-runnable: a
# migration already recorded (mid-baseline crash recovery) is skipped; any
# real failure surfaces on the `migrate deploy` that always follows.
baseline() {
  echo "[migrate] baselining migration history…"
  for d in prisma/migrations/*/; do
    npx prisma migrate resolve --applied "$(basename "$d")" >/dev/null 2>&1 \
      || echo "[migrate]   $(basename "$d"): already recorded — skipping"
  done
}

# `migrate deploy` with a P3005 net: an existing-but-unbaselined schema is
# recovered by baselining, then deploying again. Any other failure is fatal.
deploy() {
  if out=$(npx prisma migrate deploy 2>&1); then
    echo "$out"
  else
    echo "$out"
    case "$out" in
      *P3005*)
        echo "[migrate] P3005 — schema exists without migration history; recovering via baseline…"
        baseline
        npx prisma migrate deploy
        ;;
      *)
        exit 1
        ;;
    esac
  fi
}

if table_exists _prisma_migrations; then
  echo "[migrate] migration history found — applying prisma/migrations (migrate deploy)…"
  deploy
elif table_exists users; then
  # Schema without history: a previous run died between `db push` and the
  # baseline loop (or the DB predates this script). Baseline, then deploy.
  echo "[migrate] schema present but never baselined — recovering (baseline + deploy)…"
  baseline
  npx prisma migrate deploy
else
  echo "[migrate] fresh database — pushing full schema (db push)…"
  npx prisma db push --skip-generate
  baseline
fi

if node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count().then(c=>process.exit(c>0?0:1)).catch(()=>process.exit(1))"; then
  echo "[migrate] existing users found — skipping seed."
else
  echo "[migrate] first boot — seeding skill catalog + demo data…"
  npm run db:seed
fi

echo "[migrate] done."
