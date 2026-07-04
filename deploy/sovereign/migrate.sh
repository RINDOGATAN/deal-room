#!/bin/sh
# One-shot migrator for the sovereign bundle. Runs inside the builder image
# (prisma CLI + tsx + migrations + seed present). Safe to re-run any time:
#
#   docker compose run --rm migrator
#
# Schema: the repo's prisma/migrations was baselined against the cloud DB —
# the first migration ALTERs tables that an initial `db push` created, so it
# cannot bootstrap an empty database. Hence:
#   fresh DB    → prisma db push (full schema), then mark every migration
#                 as applied (baseline) so future `migrate deploy` works;
#   existing DB → prisma migrate deploy (normal path after git pull).
# Seed: skill catalog + supervisor + demo users — FIRST boot only; an
# instance that already has users is never re-seeded (the seed's upserts
# could otherwise clobber live edits to seeded rows).
set -eu
cd /app

if node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRawUnsafe(\"SELECT to_regclass('public.users')::text AS r\").then(rows=>process.exit(rows[0].r?0:1)).catch(()=>process.exit(1))"; then
  echo "[migrate] existing schema — applying prisma/migrations (migrate deploy)…"
  npx prisma migrate deploy
else
  echo "[migrate] fresh database — pushing full schema (db push)…"
  npx prisma db push --skip-generate
  echo "[migrate] baselining migration history…"
  for d in prisma/migrations/*/; do
    npx prisma migrate resolve --applied "$(basename "$d")" >/dev/null
  done
fi

if node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count().then(c=>process.exit(c>0?0:1)).catch(()=>process.exit(1))"; then
  echo "[migrate] existing users found — skipping seed."
else
  echo "[migrate] first boot — seeding skill catalog + demo data…"
  npm run db:seed
fi

echo "[migrate] done."
