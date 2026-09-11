<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# Releasing

`main` is always releasable. The hosted demo deploys from `main` and is the
daily canary. Self-hosted installs receive a release when a semver tag is
pushed: `publish-image.yml` then publishes `ghcr.io/rindogatan/deal-room` and
`ghcr.io/rindogatan/deal-room-migrator` as `:vX.Y.Z` and `:latest`, and the
suite kit picks `:latest` up on the customer's next `./suite.sh update`.

Self-hosters jump from any version to the latest one, so every release has to
answer one question: does an existing install, after upgrading, end up in the
same place as a brand new install? The routine below is built around that.

## Before tagging

1. `npm run lint`, `npx tsc --noEmit`, `npm run check:api`, `npm run
   check:skills`, `npm run test:run` — or simply let CI run them on the branch.
2. If dependencies changed, write the lockfile with `npx -y npm@10 install`
   (CI runs npm 10) and verify `npx -y npm@10 ci --dry-run` against the
   committed file.
3. If the release touches skills, migrations, or the seed, run the
   fresh-versus-upgraded check described below against a locally built
   migrator image.
4. Update `CHANGELOG.md`.

## Fresh versus upgraded

This is the check that catches an upgrade path drifting away from a fresh
install. It restores a real backup of an existing install, runs the migrator
over it, runs the same migrator over an empty database, and compares the two:
schema, migration history, row counts table by table, and the skill catalog
per contract type.

```bash
# before tagging: test the image you are about to publish
docker build -f deploy/sovereign/Dockerfile --target migrator -t deal-room-migrator:local .
scripts/upgrade-check.sh <backup-file> --image deal-room-migrator:local

# after publishing: test what customers will actually pull
scripts/upgrade-check.sh <backup-file> --version v0.1.33
```

The backup is a `pg_dump` file: plain `.sql`, `.sql.gz`, or the encrypted
`.sql.gz.enc` the suite kit writes (`./suite.sh backup`). For the encrypted
form, pass the file holding the passphrase:
`--env-file /path/to/suite/.env`, or set `BACKUP_PASSPHRASE` in the
environment. The passphrase is never printed and the databases are thrown away
at the end (`--keep` keeps them for inspection).

Reading the report:

- **Schema** and **migration history** must be identical. A difference means
  the upgrade path produces something a fresh install does not, which is the
  drift this check exists to catch. It fails the run.
- **Row counts** differ wherever the install has its own data (deals, users,
  audit logs, entitlements). Those lines are marked and are expected.
- **Skill catalog** compares clauses and options per contract type, live and
  retired. A skill the site installed itself shows as `i` and is expected. A
  `!` marks a skill both sides have whose content differs, which fails the run.

A run that ends with "the upgraded database matches a fresh install" is the
green light for the tag.

## Tagging and after

1. `git tag vX.Y.Z && git push origin vX.Y.Z`.
2. Watch `publish-image.yml`. It builds amd64 and arm64 on native runners;
   never reintroduce QEMU emulation, which hangs indefinitely.
3. Verify the published digests, then run the fresh-versus-upgraded check
   again against `--version vX.Y.Z`.
4. Write the GitHub release notes from the changelog entry.
5. The suite integration test (`todolaw-suite`) boots all three apps at
   `:latest`. A red run stops further tagging until it is fixed.

## Skill content

Skill changes reach installs in two different ways, and both need a thought
before a release:

- **Self-hosted:** the migrator refreshes the built-in skill catalog on every
  boot (`SEED_SKILLS_ONLY=true`). Clauses and options a skill no longer
  contains are removed; those an existing deal still uses are retired instead,
  so the deal keeps its text (see `prisma/skill-reconcile.ts`). To see what a
  refresh would remove without writing anything, run the seed with
  `SEED_PRUNE_DRY_RUN=true`.
- **Hosted:** the catalog is seeded from the private skills repository by its
  own workflow, against the production database. The same prune applies there,
  so run a dry-run seed against production first when a built-in skill drops a
  clause.
