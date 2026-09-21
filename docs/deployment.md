# Deployment

Dealroom is one codebase with two deployment postures. The difference between
them lives in environment variables only, never in branches.

The dual-brand setup this file used to describe (a second Vercel project with
its own skin and invite-code sign-in) was retired on 2026-05-02. The brand
plumbing in `src/config/brand.ts` remains as a single-brand passthrough (`todo`)
so a second skin could be reintroduced later.

For every variable, what it unlocks and who rotates it, see
[`secrets-inventory.md`](secrets-inventory.md). For capacity, see
[`capacity.md`](capacity.md). For the release routine, see
[`releasing.md`](releasing.md).

---

## Postures

| | Hosted | Self-hosted |
|---|---|---|
| Where | Vercel project `deal-room-todo`, domain dealroom.todo.law | TODO.LAW suite, port 8486, from `ghcr.io/rindogatan/deal-room` |
| Source | Builds from `main` on every push | Semver tag `vX.Y.Z` publishes `:vX.Y.Z` and `:latest` images |
| Database | Neon PostgreSQL (pooled URL for the app, direct URL for migrations and seeds) | Postgres container in the suite compose file |
| Sign-in | Magic link (Resend) and Google OAuth | Local email-only credentials (`NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true`, baked into the image) |
| Posture | **Free, with limits per account** (since 2026-09-16): on when `VERCEL_ENV=production` (or `AUTH_COOKIE_DOMAIN=.todo.law`); a caution against entering privileged or confidential information on the sign-up screen and in the new-deal flow; per account 1 organisation, 90 days of editing then read-only, 10 deals, 3 journeys; export at `/api/account/export` | No caps, no caution |
| Payments | None. The hosted posture switches Stripe off in the app even if Stripe variables are still set | Stripe off: neither set, every skill is free (`features.allSkillsFree`) |
| Premium skills | All available to every account at no cost; nothing is sold | 60 a year each in the kit (in your currency): `.skill` file bought on the storefront, installed on `/skills` |
| Default deal mode | Two-party | Solo |
| Migrations | `prisma migrate deploy` in the Vercel build | Migrator container (`deploy/sovereign/migrate.sh`), which also refreshes the built-in skill catalog on every boot |
| Daily cron | `vercel.json`, 09:00 UTC, `CRON_SECRET` bearer | Host cron calling `/api/cron/daily` (see `deploy/sovereign/README.md`) |

---

## Hosted environment variables

Set on the Vercel project (Production). Names only; values are in Vercel.

### Required

```
DATABASE_URL                 # Neon pooled URL
DATABASE_URL_UNPOOLED        # Neon direct URL (migrations, seeds)
NEXTAUTH_URL                 # https://dealroom.todo.law
NEXTAUTH_SECRET
RESEND_API_KEY
EMAIL_FROM
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
CRON_SECRET
AUTH_COOKIE_DOMAIN           # cross-app session cookie domain
```

### Payments (paywall on)

```
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_ENABLED=true
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID
STRIPE_PRICE_ID_USD
```

### Optional services

```
GAVEL_API_URL, GAVEL_API_KEY, GAVEL_WEBHOOK_SECRET     # dispute escalation (URL + key both required; else 503 gavel_not_configured)
DEALROOM_CLOUD_API_URL, DEALROOM_CLOUD_API_KEY         # cloud intelligence
FIRMAS_BASE_URL, FIRMAS_ISSUER, NEXT_PUBLIC_FIRMAS_BASE_URL  # verified signing
DOWNLOAD_TOKEN_SECRET                                  # signed skill downloads
LLM_GATEWAY_URL, LLM_GATEWAY_KEY, LLM_MODEL_ALIAS (+ _LOCAL/_EU/_US),
OPENAI_API_KEY, ANTHROPIC_API_KEY                      # AI assist engines
```

### Must stay unset on hosted production

```
NEXT_PUBLIC_LOCAL_AUTH_ENABLED
TESTER_MODE_ENABLED, NEXT_PUBLIC_TESTER_MODE
E2E_CREDENTIALS_SECRET
ALLOW_TEST_AUTH_PROVIDERS
FREE_TRIAL_ALL_SKILLS, NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS   # unless a promo is intended
```

Even if one of the first three is set by mistake, `src/lib/auth-provider-policy.ts`
refuses to register the passwordless providers when `VERCEL_ENV=production` and
logs an error.

---

## Self-hosted environment variables

The suite kit's `.env` feeds `deploy/sovereign/docker-compose.yml`. The required
values are `PUBLIC_URL`, `NEXTAUTH_SECRET` and `POSTGRES_PASSWORD`; set
`CRON_SECRET` too so reminders and expiry run. Everything else is optional and
degrades gracefully when empty. `NEXT_PUBLIC_*` values are baked in at image
build time; changing them in `.env` only affects server rendering. Details in
`deploy/sovereign/README.md`.

---

## Schema and seed rules

- Migrations are append-only. Create them with `prisma migrate dev`; they deploy
  through the Vercel build (hosted) or the migrator container (self-host).
- Never run `prisma db push` against production.
- Seeding production skills: see "Seeding Skills to Production" in the project
  instructions and `docs/skills-sync.md`.

---

## Health and smoke test

`GET /api/health` returns 200 with a database probe, or 503 when the database is
unreachable. It is limited to 60 requests per minute per client address, which is
well above any uptime monitor's polling rate.
