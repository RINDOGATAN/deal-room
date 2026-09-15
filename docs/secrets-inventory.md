# Secrets and configuration inventory

Every environment variable the code reads, where it is set, what it unlocks,
who rotates it and when it was last rotated. **Names only.** No value belongs
in this file, in the repository or in a ticket.

Cross-checked on 2026-09-14 against every `process.env` read (and the
`env("...")` reads in `prisma/schema.prisma` and `src/server/services/ai/llm-door.ts`)
under `src/`, `prisma/`, `scripts/`, `e2e/`, the Playwright and Next configs,
`deploy/sovereign/` and `.github/workflows/`.

## Where things live

- **Hosted:** the Vercel project for dealroom.todo.law (Production and Preview
  environments). Pull with `npx vercel env pull .env.prod --environment production`,
  use, delete.
- **Kit .env:** the self-host suite's `.env`, passed to the app and migrator by
  `deploy/sovereign/docker-compose.yml`. Each self-hosting customer owns theirs.
- **Build arg:** `NEXT_PUBLIC_*` values are inlined into the browser bundle at
  build time (Vercel build, or `deploy/sovereign/Dockerfile` for published images).
  Changing them requires a rebuild. They are never secret.
- **CI:** GitHub Actions on this repository. `ci.yml` uses only a throwaway
  Postgres; `publish-image.yml` uses the automatic `GITHUB_TOKEN`.
- **Local:** `.env` / `.env.local` on a developer machine, pointing at the local
  Docker Postgres. Never live keys.

"Owner" below means the operator of the hosted service. Last rotation: the owner
rotated every hosted API key and updated the Vercel variables on **2026-08-05**;
rows marked "2026-08-05" are covered by that rotation. "Unknown" means no record.

## Secrets

| Variable | Where it lives | What it unlocks | Who rotates | Last rotation |
|---|---|---|---|---|
| `DATABASE_URL` | Hosted (Neon pooled URL); kit .env (composed from `POSTGRES_PASSWORD`); CI (throwaway); legalskills repo secret (unpooled) | Full read/write to the application database | Owner (Neon console); customer on self-host | Unknown |
| `DATABASE_URL_UNPOOLED` | Hosted (Neon direct URL); kit compose; CI (throwaway) | Same database, direct connection used by migrations and seeds | Owner; customer | Unknown |
| `POSTGRES_PASSWORD` | Kit .env | Self-host Postgres superuser | Customer | Customer's record |
| `NEXTAUTH_SECRET` | Hosted; kit .env | Signs every session JWT and the supervisor 2FA gate. Leak = forge any session | Owner; customer | 2026-08-05 |
| `GOOGLE_CLIENT_SECRET` | Hosted; kit .env (optional) | Google OAuth sign-in for the client ID | Owner (Google Cloud console) | 2026-08-05 |
| `RESEND_API_KEY` | Hosted; kit .env (optional) | Sends e-mail as the verified sender domain (magic links, invitations, signing) | Owner (Resend) | 2026-08-05 |
| `STRIPE_SECRET_KEY` | Hosted | Live Stripe account: checkout, subscriptions, refunds. Also switches the paywall on | Owner (Stripe dashboard) | 2026-08-05 |
| `STRIPE_WEBHOOK_SECRET` | Hosted | Verifies inbound `/api/webhooks/stripe` events | Owner (Stripe dashboard) | 2026-08-05 |
| `CRON_SECRET` | Hosted; kit .env | Calls `/api/cron/daily` (signing reminders, expiry, purges). Unset = 503 | Owner; customer | 2026-08-05 |
| `GAVEL_API_KEY` | Hosted; kit .env (optional) | Files disputes with the Gavel service. Needs `GAVEL_API_URL` alongside; either unset = dispute endpoint 503 `gavel_not_configured` | Owner | 2026-08-05 |
| `GAVEL_WEBHOOK_SECRET` | Hosted; kit .env (optional) | Verifies inbound `/api/webhooks/gavel`. Unset = 503 | Owner | 2026-08-05 |
| `DEALROOM_CLOUD_API_KEY` | Hosted; kit .env (optional) | Dealroom Cloud intelligence API (biases, quality, certification) | Owner | 2026-08-05 |
| `DOWNLOAD_TOKEN_SECRET` | Hosted; kit .env (optional) | Signs short-lived skill download tokens | Owner; customer | Unknown |
| `E2E_CREDENTIALS_SECRET` | Local / preview only; test runner | Passwordless end-to-end sign-in. Refused on hosted production by `auth-provider-policy.ts` | Owner | Unknown |
| `OPENAI_API_KEY` | Hosted or kit .env (optional; not in compose) | Paid AI assist calls | Owner; customer | Unknown |
| `ANTHROPIC_API_KEY` | Hosted or kit .env (optional; not in compose) | Paid AI assist calls | Owner; customer | Unknown |
| `LLM_GATEWAY_KEY`, `LLM_GATEWAY_KEY_LOCAL`, `_EU`, `_US` | Hosted or kit .env (optional; not in compose) | OpenAI-compatible gateway per confidentiality lane | Owner; customer | Unknown |
| `SKILL_SIGNING_PRIVATE_KEY` | Storefront (todolaw) Vercel project; a signing machine running `scripts/build-skill-packages.ts` | Signs premium skill packages and licences. Leak = forge licences for every install | Owner | Unknown |
| `BLOB_READ_WRITE_TOKEN` | Storefront Vercel project; machine running `scripts/upload-skill-packages.ts` | Writes the skill package blob store | Owner | Unknown |
| `BACKUP_PASSPHRASE` | Kit .env | Encrypts and decrypts suite backups (`backup.sh` / `restore.sh`) | Customer | Customer's record |
| `GITHUB_TOKEN` | CI (automatic) | Pushes images to ghcr.io from `publish-image.yml` | GitHub (per run) | Per run |
| `DEAL_ROOM_TOKEN` | legalskills repo secret | Used by that repo's seed workflow | Owner | Unknown |

## Configuration (not secret, listed so nothing is missing)

| Variable | Where it lives | What it controls |
|---|---|---|
| `NEXTAUTH_URL` (kit: `PUBLIC_URL`) | Hosted; kit .env | Public base URL for auth callbacks and e-mail links |
| `AUTH_COOKIE_DOMAIN` | Hosted; kit .env (empty) | Session cookie domain (cross-app SSO on hosted) |
| `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Hosted; kit .env | Google OAuth client ID |
| `EMAIL_FROM` | Hosted; kit .env | Sender address |
| `STRIPE_PRICE_ID`, `STRIPE_PRICE_ID_USD` | Hosted; seed | Price IDs for checkout |
| `NEXT_PUBLIC_STRIPE_ENABLED` | Hosted (build) | Client-side paywall UI |
| `FREE_TRIAL_ALL_SKILLS`, `NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS` | Hosted; kit (off) | Promo window with all skills free |
| `NEXT_PUBLIC_LOCAL_AUTH_ENABLED` | Build arg (`true` in published images) | Self-host posture and local sign-in |
| `TESTER_MODE_ENABLED`, `NEXT_PUBLIC_TESTER_MODE` | Kit (false); unset on hosted | Tester sign-in and data reset |
| `ALLOW_TEST_AUTH_PROVIDERS` | CI or local production builds only | Opt-in for tester/e2e providers on a non-hosted production build |
| `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA` | Vercel (automatic) | Hosted production detection, base URL, commit in `/api/health` |
| `NODE_ENV`, `PORT` | Runtime | Build mode; listen port |
| `NEXT_OUTPUT_STANDALONE` | Dockerfile | Standalone Next output for images |
| `NEXT_PUBLIC_BRAND`, `NEXT_PUBLIC_BRAND_NAME`, `_ACCENT`, `_LOGO_URL` | Build arg | Brand passthrough (single brand `todo`) |
| `NEXT_PUBLIC_SOURCE_URL`, `NEXT_PUBLIC_SOURCE_PUBLIC`, `NEXT_PUBLIC_COMMIT_SHA` | Build arg | AGPL source offer on `/licenses` |
| `NEXT_PUBLIC_MARKETPLACE_URL` | Build arg | Storefront deep links |
| `NEXT_PUBLIC_AI_ASSIST_ENABLED` | Build arg | AI assist UI |
| `LLM_GATEWAY_URL`, `LLM_MODEL_ALIAS` (+ `_LOCAL`, `_EU`, `_US`) | Hosted or kit .env | AI gateway endpoint and model per lane |
| `DEALROOM_CLOUD_API_URL`, `GAVEL_API_URL` | Hosted; kit .env | Sibling service endpoints |
| `FIRMAS_BASE_URL`, `FIRMAS_ISSUER`, `NEXT_PUBLIC_FIRMAS_BASE_URL` | Hosted; kit .env | Identity-verified signing service |
| `SKILL_SIGNING_PUBLIC_KEY` | Optional override | Rotation-only override of the baked licence public key |
| `SKILLS_DIR`, `INSTALLED_SKILLS_DIR`, `DEFAULT_LANGUAGE` | Kit compose; seed runs | Skill library paths; default language |
| `SEED_SKILLS_ONLY`, `SEED_PRUNE_DRY_RUN` | Migrator; seed runs | Seed behaviour |
| `DEAL_ROOM_INSTANCE_ID` | Kit .env | Stable licensing fingerprint |
| `LOG_LEVEL`, `DEBUG` | Any | Logger verbosity |
| `BACKUP_RCLONE_REMOTE`, `BIND_ADDR`, `TLS_DOMAIN` | Kit .env | Off-site backup target, bind address, Caddy TLS domain |
| `CI`, `E2E_BASE_URL`, `E2E_API_KEY`, `DEMO_PAUSE_*` | Test runner | Playwright settings (`E2E_API_KEY` is a test `drk_` key: treat as secret) |

## Gaps found during the cross-check

- The rotation date for the database credentials, `DOWNLOAD_TOKEN_SECRET`, the
  skill signing private key and the blob token is not recorded anywhere in this
  repository. The owner should record it here at the next rotation.
- The AI provider variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `LLM_*`) and
  `NEXT_PUBLIC_AI_ASSIST_ENABLED` are read by the code but not passed through
  `deploy/sovereign/docker-compose.yml`, so a self-hoster cannot set them through
  the kit .env today.
