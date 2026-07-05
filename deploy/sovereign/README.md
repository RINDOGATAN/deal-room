# Dealroom — Sovereign bundle

The full Dealroom stack on firm hardware, one command. Same app code as
the cloud deployment (dealroom.todo.law) — only environment differs
(portability doctrine: one codebase, two postures, switched by env,
never forked).

```
Postgres 16      firm deal/negotiation data          db
migrator         prisma migrate deploy + first-boot seed (one-shot)
Next.js app      the SAME app the cloud runs         app  → http://localhost:8486
```

Posture differences from cloud, all env-driven:

- **Auth:** local credentials login (email, no password, no external
  services) via `NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true`. Google OAuth and
  Resend magic links are cloud-tier options, off by default. Enabling
  Google needs `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (runtime) AND
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — the latter feeds the sign-in button and
  is baked in at build time, so set it before building (or rebuild). The
  auth cookie is host-only (`AUTH_COOKIE_DOMAIN=""`); the `.todo.law`
  cross-app SSO domain is cloud-only.
- **Stripe:** off. The skill marketplace billing is the cloud tier; the
  app boots and functions fully with empty `STRIPE_*` vars, and
  `FREE_TRIAL_ALL_SKILLS=true` unlocks every premium skill locally.
- **Cloud services:** `DEALROOM_CLOUD_API_*` (intelligence/certification),
  `GAVEL_*` (disputes), `FIRMAS_*` (mobile signing) all degrade
  gracefully when empty — the app runs, those features are visibly off.
- **Brand:** `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_ACCENT`,
  `NEXT_PUBLIC_BRAND_LOGO_URL` thread through `src/config/brands/todo.ts`.
  Same UI, your name on it — no clones.

## First run

```sh
cd deploy/sovereign
cp .env.example .env       # set POSTGRES_PASSWORD, NEXTAUTH_SECRET, PUBLIC_URL
chmod 600 .env
docker compose up -d --build
docker compose logs migrator   # wait for "[migrate] done."
open http://localhost:8486
```

Sign in at `/sign-in` with the local login box (any email creates an
account). Port 8486 — 8484 is LexBooks and 8485 is DPO Central on this
hardware.

## Day-2 operations

- **Schema after `git pull`:** `docker compose run --rm migrator` — re-runs
  `prisma migrate deploy`; the seed is skipped once the instance has users.
  The migrator self-heals a half-initialized DB (schema present but never
  baselined, e.g. a run that died mid-setup, or Prisma error P3005): it
  baselines the migration history and re-runs the deploy on its own.
- **Health:** the app container has a compose healthcheck against
  `/api/health` (a real Postgres probe, 200/503). `docker compose ps` shows
  `healthy`/`unhealthy`; the TLS proxy waits for `healthy` before starting.
- **Rebuild after an update or brand/posture change:**
  `docker compose up -d --build app`. All `NEXT_PUBLIC_*` vars are baked in
  at build time — editing them in `.env` without a rebuild does nothing.
- **Daily cron:** the cloud uses a Vercel cron for signing reminders and
  expiry (`GET /api/cron/daily`, guarded by `CRON_SECRET`). Locally,
  schedule it yourself: `crontab -e` →
  `0 9 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:8486/api/cron/daily`
- **Backups:** `./backup.sh` — encrypted (AES-256) pg_dump + the
  installed-skills volume, 14-artifact local retention, optional
  off-machine push via `BACKUP_RCLONE_REMOTE`. Set `BACKUP_PASSPHRASE`
  in `.env`. Schedule daily: `crontab -e` →
  `15 3 * * * cd <this dir> && ./backup.sh >> backups/backup.log 2>&1`
- **Restore:** `./restore.sh <db.enc> [skills.enc]` — wipes the target
  instance and restores (type RESTORE to confirm).

## Sync & travel replica (cloud + local copies)

**Local is primary.** Same discipline as the LexBooks and DPO Central
bundles: the replica is this same compose stack elsewhere, seeded with
`./restore.sh` from the latest backup, one active side at a time. Two-way
merge of concurrent edits is deliberately unsupported.

## Hardening (beyond localhost)

The full checklist lives in the LexBooks template
(`APPS/LexBooks/deploy/sovereign/HARDENING.md`) — same pattern applies here.
The short version:

1. **Network:** default `BIND_ADDR=127.0.0.1` needs nothing. Office LAN:
   `BIND_ADDR=0.0.0.0` + firewall the box to the office subnet. Never expose
   8486 to the internet raw.
2. **TLS:** `TLS_DOMAIN=dealroom.firm.example`,
   `PUBLIC_URL=https://dealroom.firm.example`, then
   `docker compose --profile tls up -d --build app` (PUBLIC_URL is baked
   into the app). Public DNS → Let's Encrypt; LAN hostname → Caddy
   internal CA.
3. **Auth:** the local login creates an account for ANY email typed into it —
   that is fine behind 127.0.0.1 or a firewalled LAN, and exactly why this
   port must never face the internet. For a public-facing replica, disable it
   (`NEXT_PUBLIC_LOCAL_AUTH_ENABLED=false`) and use the Google/Resend
   cloud-tier options instead.
4. **Secrets:** `chmod 600 .env`. Rotating `NEXTAUTH_SECRET` signs everyone
   out (JWT sessions) — rotate deliberately.
5. **Data:** nightly `./backup.sh` on cron; quarterly, actually run
   `./restore.sh` somewhere disposable. An untested backup is a hope, not a
   backup.
6. **Updates:** `git pull` → `docker compose run --rm migrator` →
   `docker compose up -d --build app`. Base images are pinned by digest
   (`tag@sha256:…` — a tag can move, a digest cannot); bump deliberately,
   snapshot a backup first, and refresh a pin with
   `docker buildx imagetools inspect <image:tag>` → copy the Digest line
   into the Dockerfile / compose file.

## Notes & limits

- **Admin & supervisor portals** (`/admin`, `/supervise`) authenticate via
  Resend magic-link emails only — they need `RESEND_API_KEY` +
  `EMAIL_FROM` set (and rows created via `npm run admin:create` /
  `npm run supervisor:create`). The seed provides a demo supervisor. The
  main app needs neither.
- **Marketplace `.skill` downloads** (`/api/skills/<id>/download`) redirect
  to `SkillPackage.packageUrl` — a Vercel Blob URL on cloud. A sovereign
  instance has no blob store; built-in skills (baked into the image) and
  CLI-installed skills (`INSTALLED_SKILLS_DIR` volume) cover local use.
  Adapter gap noted, deliberately not built.
- License: AGPL-3.0-or-later (see repo LICENSE) — self-hosting your own
  instance is exactly the intended use.
