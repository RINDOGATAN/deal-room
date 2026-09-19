# Security by deployment posture

`SECURITY.md` at the repository root is the public policy: how to report a
problem, which versions are supported, and what the build implements. This
page separates the two ways Dealroom runs, because who is responsible for
each control differs between them. Variable names are listed in
`docs/secrets-inventory.md`; no value belongs here.

## Hosted (dealroom.todo.law)

The operator runs the service for its users.

| Control | How it is handled |
| --- | --- |
| Hosting | Vercel project, deployed from `main`. |
| Database | Managed Neon PostgreSQL (pooled URL for the app, unpooled for migrations and seeding). |
| Sign-in | Magic-link e-mail and Google OAuth. The local, tester and end-to-end providers are never registered on hosted production (`src/lib/auth-provider-policy.ts`). |
| Secrets | Vercel environment variables, set and rotated by the operator. Pulled to a machine only as a temporary `.env.prod`, deleted after use. |
| Payments | Stripe, enabled only when both `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_ENABLED=true` are set. The inbound Stripe webhook verifies signatures and records each event once. |
| Inbound webhooks | Gavel and Stripe refuse unsigned or wrongly signed calls; the Gavel webhook answers 503 when its secret is not set. |
| Scheduled jobs | `/api/cron/daily` runs from Vercel cron and answers 503 unless `CRON_SECRET` is set and presented. |
| TLS | Terminated by Vercel. |
| Backups | Neon's own history and restore. A restore rehearsal is an owner action (see `STATUS.md`, not committed). |
| Schema changes | `prisma migrate deploy` in the Vercel build. See `docs/migrations.md`. |

## Self-hosted (TODO.LAW suite, port 8486)

The customer runs the published images on their own machine or network and
is responsible for everything outside the application code.

| Control | How it is handled |
| --- | --- |
| Hosting | Published images `ghcr.io/rindogatan/deal-room` and `-migrator`, started by the suite kit. |
| Database | Local PostgreSQL container in the kit. |
| Sign-in | Local e-mail-only sign-in (`NEXT_PUBLIC_LOCAL_AUTH_ENABLED`). It has no password: anyone who can reach the app can sign in as any address. Keep the install on a private network. |
| Secrets | The kit's `.env`, owned by the customer. Replace the placeholder values of `NEXTAUTH_SECRET`, `CRON_SECRET` and the database password. |
| Payments | None. Stripe variables are not set, so every skill is free; premium skills arrive as signed `.skill` files verified offline (`src/lib/crypto.ts`). |
| Inbound webhooks | Same code as hosted; a webhook whose secret is not set refuses every call. |
| Scheduled jobs | The customer wires host cron to `/api/cron/daily` (see `deploy/sovereign/README.md`). |
| TLS | Not terminated by the app. Use the kit's Caddy profile or another reverse proxy; that proxy should also overwrite `X-Forwarded-For`, which the rate limits read. |
| Backups | `backup.sh` (encrypted `pg_dump`, `BACKUP_PASSPHRASE`) nightly; `restore.sh` rehearsed on a disposable machine each quarter. |
| Schema changes | The migrator container on every start. See `docs/migrations.md`. |

## Common to both

- The same code runs in both postures; the differences come from environment
  variables only, never from branches.
- CI fails on any high or critical npm advisory.
- The admin and supervisor portals require a server-verified TOTP code.
- Skill packages and licence files are signed with Ed25519 and verified
  before activation.
