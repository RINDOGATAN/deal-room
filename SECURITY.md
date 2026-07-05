# Security Policy

This document describes the security posture of **this build** of Dealroom —
what is actually implemented, what is deliberately out of scope, and how to
report problems. It is not aspirational.

## Reporting a vulnerability

Email **info@rindogatan.com** with subject `SECURITY: <short summary>`.
Include reproduction steps and the deployment mode (hosted vs. sovereign/self-hosted).

- You will get an acknowledgement within 5 business days.
- Please practice coordinated disclosure: give us 90 days before publishing.
- There is currently no bug bounty program.

## Supported versions

Only the `main` branch (currently `0.1.x`) is supported. There are no
maintained release branches yet; self-hosters should track `main` or a
tagged state they have reviewed themselves.

## What is implemented in this build

- **Authentication:** NextAuth — magic-link email sign-in and Google OAuth
  for users. Admin (`/admin`) and supervisor (`/supervise`) portals use
  separate sessions.
- **Second factor for privileged portals:** TOTP (otpauth). The gate cookie
  for `/admin` and `/supervise` is only set after **server-side** TOTP code
  verification in the verify endpoints (`platform-admin-2fa-verify`,
  `supervisor-2fa-verify`).
- **Cron endpoints fail closed:** `GET /api/cron/daily` returns 503 unless
  `CRON_SECRET` is set and presented as a bearer token.
- **Dispute webhook fails closed:** the Gavel webhook rejects unsigned or
  unverifiable requests.
- **Licensing integrity:** skill packages and offline license files are
  signed with Ed25519 and verified before activation (`src/lib/crypto.ts`).
- **Health probe:** `/api/health` performs a real database check and returns
  200/503 with `Cache-Control: no-store`; the sovereign compose file uses it
  as the container healthcheck.

## Known limitations (honest list)

- **Rate limiting is in-memory and per-instance.** It does not survive
  restarts and does not coordinate across replicas. Front the app with your
  own limiter if you scale horizontally.
- **Tester mode is compiled into the artifact.** `TESTER_MODE_ENABLED=true`
  + `NEXT_PUBLIC_TESTER_MODE=true` expose passwordless sign-in for three
  fictitious tester accounts and a self-service data-reset endpoint. Both
  flags MUST remain unset in any production deployment. The endpoints 404
  when the flags are off.
- **No enforced test-coverage gate in CI** yet; coverage of the tRPC router
  and auth surface is early (see `CHANGELOG.md`).
- **TLS is not terminated by the app.** Use the sovereign kit's Caddy
  profile or your own reverse proxy.
- **Marketplace package downloads** depend on a cloud blob store; on a
  sovereign box, use baked skills or CLI install instead.

## Deployment hygiene for self-hosters

- Never commit or ship `.env*` files; rotate any secret that has ever left
  the machine. The publish pipeline should emit from `git archive`, not a
  working-directory zip.
- Set strong values for `NEXTAUTH_SECRET`, `CRON_SECRET`, and the database
  password; the compose defaults are placeholders.
- Wire host cron for `/api/cron/daily` (see `deploy/sovereign/README.md`) or
  signing reminders/expiry will silently never run.

## License note (AGPL §13)

Dealroom is AGPL-3.0-or-later. If you run a modified version as a network
service, you must offer its Corresponding Source to your users. The app
footer renders a "Source code (AGPL-3.0)" link for this purpose — point it
at your fork via `NEXT_PUBLIC_SOURCE_URL` at build time.
