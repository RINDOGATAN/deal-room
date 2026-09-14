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

Only the latest release is supported: the newest `vX.Y.Z` tag (currently
`0.1.x`), published as `ghcr.io/rindogatan/deal-room:latest`, and `main`,
which the hosted service deploys. There are no maintained release branches;
fixes ship in a new tag, and self-hosters receive it with `./suite.sh update`.

## Deployment postures

- **Hosted (dealroom.todo.law):** runs on Vercel with a managed Neon
  PostgreSQL database. Users sign in by magic link or Google. Payments run
  through Stripe. The operator manages secrets, TLS and backups.
- **Self-hosted (TODO.LAW suite, port 8486):** runs from the published
  container images on the customer's own machine or network. Users sign in
  with the local email-only provider, which is meant for a private network.
  The customer manages secrets, TLS, backups and exposure to the internet.

## What is implemented in this build

- **Authentication:** NextAuth. Hosted: magic-link email sign-in and Google
  OAuth. Self-hosted: local email-only sign-in
  (`NEXT_PUBLIC_LOCAL_AUTH_ENABLED`). Admin (`/admin`) and supervisor
  (`/supervise`) portals use separate sessions.
- **Passwordless providers refused on production builds:** the local,
  tester and end-to-end sign-in providers are never registered on hosted
  production (`VERCEL_ENV=production`), whatever the variables say. On other
  production builds the tester and end-to-end providers also need
  `ALLOW_TEST_AUTH_PROVIDERS=true` (`src/lib/auth-provider-policy.ts`).
- **Rate limits:** a database-backed counter, shared by all instances and
  kept across restarts, limits the agent API, sign-in attempts, magic-link
  e-mails, skill download and install, and `/api/health`
  (`src/server/middleware/public-rate-limit.ts`). Expired counters are
  purged by the daily cron.
- **Dependency audit:** CI fails on any high or critical npm advisory.
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

- **Rate limits fail open.** If the counter cannot be written (database
  unreachable), requests are allowed and the failure is logged. Limits are
  keyed on the first `X-Forwarded-For` address, which a client can forge
  when the app is reached directly rather than through Vercel or a reverse
  proxy that overwrites the header. Self-hosters exposing the app should put
  such a proxy in front.
- **Local sign-in has no password.** On a self-hosted install anyone who can
  reach the app can sign in as any e-mail address. Keep it on a private
  network; do not expose a self-hosted instance to the internet as is.
- **Tester mode is compiled into the artifact.** `TESTER_MODE_ENABLED=true`
  + `NEXT_PUBLIC_TESTER_MODE=true` expose passwordless sign-in for three
  fictitious tester accounts and a self-service data-reset endpoint. The
  provider is refused on hosted production (see above), but the flags should
  still remain unset in any production deployment. The endpoints 404 when
  the flags are off.
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
