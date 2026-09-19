# Database migrations

## Rule: forward-only

Migrations in `prisma/migrations/` are append-only. A migration that has been
merged to `main` is never edited, renamed, squashed or deleted, because a
self-hosted install may jump from any published version straight to the
latest one and must be able to apply every step in between.

- Create a migration with `npx prisma migrate dev --name <what_changes>`
  against the local Docker Postgres, and commit it with the code that needs it.
- To undo a change, write a new migration that reverses it. There is no
  down-migration.
- A new column on an existing table needs a default or must be nullable, so
  the migration runs over tables that already hold rows.
- Never run `prisma db push` against a production database.

## How each posture applies them

- **Hosted:** the Vercel build runs `prisma migrate deploy` before
  `next build`. A migration that fails stops the build, and the previous
  deployment keeps serving.
- **Self-hosted:** the migrator container (`deploy/sovereign/migrate.sh`)
  runs on every start. On an empty database it creates the schema and records
  every migration as applied; on an existing one it runs
  `prisma migrate deploy`. A database left half-initialized (Prisma error
  P3005) is recovered by recording the history and deploying again. The app
  container starts only after the migrator succeeds.

## Rehearsing an upgrade

Before every release tag that touches migrations, skills or the seed, run the
fresh-versus-upgraded check described in `docs/releasing.md`:

```bash
docker build -f deploy/sovereign/Dockerfile --target migrator -t deal-room-migrator:local .
scripts/upgrade-check.sh <backup-file> --image deal-room-migrator:local
```

It restores a real backup of an existing install, runs the new migrator over
it and over an empty database, and compares schema, migration history, row
counts per table and the skill catalog. The schema and history must match
exactly. Run it again against the published image after the tag
(`--version vX.Y.Z`).

For the hosted database, rehearse on a Neon branch taken from production
rather than on production itself: create the branch, point
`DATABASE_URL` at it, run `npx prisma migrate deploy`, check the app, then
delete the branch.
