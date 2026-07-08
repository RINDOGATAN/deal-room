# Migration baseline (`0_init`) — read before deploying

## What happened

The migration history was **not runnable from an empty database**. The oldest
migration (`20260303000000_add_user_role`) ran `ALTER TABLE "users"` and other
statements against tables that **no migration ever created** — the core schema
(`users`, `deal_rooms`, `accounts`, ~27 tables) had been established with
`prisma db push` and never captured as a migration. So `prisma migrate deploy`
failed on any fresh database: CI, and every fresh self-hosted install.

## The fix

The 23 partial migrations were **squashed into a single baseline** migration
`prisma/migrations/0_init/migration.sql`, generated from the current schema with:

    prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script

Verified against a throwaway Postgres 16:

- `migrate deploy` to an empty DB applies `0_init` and reports "schema is up to
  date" (fresh installs + CI now work).
- **Parity:** the schema produced by `0_init` diffs **empty** against a
  `db push` of the current `schema.prisma` — i.e. `0_init` reproduces the current
  schema exactly, with no drift.

Old migrations remain in git history if ever needed for forensic reference.

## PRODUCTION: one-time baseline step — DO THIS BEFORE MERGING / DEPLOYING

Production already contains every table, so a naive `migrate deploy` of `0_init`
against it fails with **P3005** ("database schema is not empty"). Because the
Vercel build runs `prisma migrate deploy` against production on every deploy,
**production must be baselined first**, or the next deploy will fail (no data is
lost — the deploy just aborts and prod keeps running the current version).

Run this **once, against production, before this change is merged/deployed**
(you need the prod connection strings; nothing runs any SQL against your data):

    DATABASE_URL="<prod pooled URL>" \
    DATABASE_URL_UNPOOLED="<prod direct URL>" \
    npx prisma migrate resolve --applied 0_init

This records `0_init` as already-applied in production's `_prisma_migrations`
**without executing its SQL**. Verified end-to-end on a prod-like database:
after `resolve --applied 0_init`, `migrate deploy` reports "No pending migrations
to apply. Database schema is up to date!"

Order of operations:
1. Run the `migrate resolve` command above against production.
2. Merge this PR. The next Vercel deploy's `migrate deploy` is now a no-op.

Running the `resolve` before merging is safe for the current `main` too: prod
still has the 23 old migrations recorded, so deploys of the pre-merge code remain
no-ops.

### Optional cleanup (anytime after)

Production's `_prisma_migrations` still lists the 23 old migration names, now
orphaned (harmless — `migrate deploy` ignores records with no folder). To tidy:

    DELETE FROM "_prisma_migrations" WHERE migration_name <> '0_init';
