# Changelog

All notable changes to Dealroom are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is
pre-1.0, so minor versions may break things.

This file starts at the current state of the project (July 2026); earlier
history was not tracked per-release and lives only in git.

## [Unreleased]

### Added
- Governance set: `SECURITY.md`, `CONTRIBUTING.md`, `NOTICES.md`, this
  changelog; AGPL §13 "Source code" offer rendered in the app footers
  (configurable via `NEXT_PUBLIC_SOURCE_URL`).
- `check:skills` now scans clause legal text for leaked bracket
  placeholders (undeclared ALL-CAPS / Title-Case tokens) in addition to
  boilerplate.
- Skills drift detection: checksum manifest tooling and
  `docs/skills-sync.md` for comparing baked `skills/` against the upstream
  `legalskills` catalog.
- First test coverage for tRPC router scoping, admin/supervisor 2FA
  verification, and licensing entitlement checks.
- Sovereign kit: app container healthcheck wired to `/api/health`,
  digest-pinned base images, resource limits, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  threaded as a build arg (Google sign-in previously shipped broken in the
  image), migrator P3005 self-heal/atomic baseline.

### Fixed
- **Security:** admin and supervisor 2FA verify endpoints now require
  server-side TOTP code verification before setting the gate cookie
  (previously any holder of a valid session could obtain the second-factor
  cookie without a code).
- Delaware Certificate of Incorporation skill re-tagged `DELAWARE`
  (was mis-tagged `CALIFORNIA`); jurisdiction tags now map explicitly onto
  the deal engine's governing-law enum.
- MSA `[NAMED COMPETITORS]` placeholder normalized to the lower-case
  fill-in convention (EN/ES) so unfilled optional tokens read as drafting
  blanks.

### Removed
- Payments removed from the hosted deployment. With Stripe unset, all skills
  are free for everyone and no longer depend on the `FREE_TRIAL_ALL_SKILLS`
  promo env var. Stripe code stays dormant behind `features.stripeEnabled`
  (reversible). Premium value moves to downloadable LQ.AI skill installs.
- Real personal data and live credentials from seeds, docs, and tracked
  internal audit files (replaced with fictional fixtures).

## [0.1.0] — baseline, 2026-07

Initial public baseline. Highlights of what exists at this point:

- Two-party async contract negotiation with weighted compromise engine
  (firmness × option bias, global fairness pass) and solo mode.
- Six baked skills (NDA, MSA, DPA, SaaS, Privacy Notice, Delaware
  Certificate of Incorporation) with near-complete EN/ES bilingual parity;
  skills marketplace with Ed25519-signed packages and offline licensing.
- Document generation (DOCX/PDF), type-to-sign signing flow with expiry
  cron, supervisor and platform-admin portals with TOTP 2FA.
- Agent Negotiation REST API + A2A skill catalog; `/api/health` probe.
- Sovereign self-host kit (`deploy/sovereign/`): Docker Compose, migrator,
  backup/restore, optional Caddy TLS, port 8486.
