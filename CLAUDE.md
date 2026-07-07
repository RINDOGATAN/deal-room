# Dealroom

Contract negotiation platform with weighted compromise algorithm.

**Stack:** Next.js 14 | TypeScript | tRPC | PostgreSQL + Prisma | NextAuth
**Build:** `prisma migrate deploy && prisma generate && next build`
**Brand:** Single brand — `todo` (dealroom.todo.law). The dual-brand NEL deployment was retired on 2026-05-02 (no clients on the second skin, maintenance cost was real). The brand-config plumbing in `src/config/brand.ts` is retained as a single-brand passthrough so a future second skin can be re-introduced without restructuring everything.

## Core Concepts

**Statuses:** DRAFT → AWAITING_RESPONSE → NEGOTIATING → AGREED → SIGNING → COMPLETED (+ CANCELLED)
**Modes:** `NEGOTIATION` (two-party) | `SOLO` (single-party)
**Compromise:** `stake = ((5-flexibility)/5 * 0.6) + (|bias| * 0.4)` — UI shows "firmness" (= 6 - flexibility)
**Signing:** type-to-sign via `SigningRequest` model. The `ISigningProvider` interface is extensible — additional providers can be added without changing call sites.
**Parameters:** `[bracket]` tokens in clause text, `{curly}` variables in boilerplate. `boilerplateVariable` in parameters.json bridges the two.

## Skills (Open-Core Model)

**All skills are currently free.** Payments were removed (see "Payments removed" below), so on the hosted deployment `features.allSkillsFree` is true and every skill seeds and serves without an entitlement. The "premium" tier below is the historical catalog split and a **future** paid layer (downloadable LQ.AI plug-ins / local install), not a live paywall.

- **Built-in (6):** `skills/` — nda, msa, saas, dpa, privacy-notice, delaware-certificate-of-incorporation
- **Extended (27):** Private `RINDOGATAN/legalskills` repo — **never commit these skills to this repo**. Served free today; the intended future paid path is a downloadable install, not server-side gating.
- **A2A (12):** Agent-to-Agent skills in `RINDOGATAN/legalskills` — Gavel dispute resolution
- 44 of 45 bilingual EN/ES (Delaware Cert of Incorporation is English-only by design), 3 jurisdictions (CALIFORNIA, ENGLAND_WALES, SPAIN)
- Seed defaults `biasPartyA`/`biasPartyB` to `0` when missing
- Entitlement/licensing code (`SkillEntitlement`, `skills.listTemplatesWithAccess`) still exists and stays dormant; with `allSkillsFree` true it short-circuits to `requiresLicense: false` for everyone

### Seeding Skills to Production

The legalskills repo has a GitHub Actions workflow (`.github/workflows/seed.yml`) that seeds on push to skill files. It uses the `DATABASE_URL` secret on that repo — **this must match the Vercel production unpooled URL**.

To seed manually from a local machine (safest approach):
```bash
# Pull the production unpooled URL from Vercel
npx vercel env pull .env.prod --environment production
# Seed with premium skills
DATABASE_URL="<unpooled URL from .env.prod>" SKILLS_DIR=/path/to/legalskills npx prisma db seed
# Clean up
rm .env.prod
```

**Never run `prisma db push` against production.** Vercel manages schema via `prisma migrate deploy`.

## APIs

- **Agent:** `/api/v1/agent/` — playbooks, negotiation, deals, webhooks, credits, MCP/A2A. Docs: `docs/agent-api.md`
- **A2A Rate Limits:** `A2A_` prefixed contract types have weekly limits — standard: 5/skill/week, premium (`premiumA2A` in Customer.metadata): 300/week
- **Idempotency:** All 9 mutating agent POST endpoints honor an optional `Idempotency-Key` header (24h TTL, table `idempotency_records`). Replays return the cached 2xx response with an `Idempotent-Replay: true` header — described on `.well-known/agent.json` for federated discovery. Helper at `src/server/middleware/idempotency.ts`.
- **Experts:** `/api/v1/experts/` — search, get-by-ID, filters, contact, verify. Auth: `drk_...` tokens with scopes (`experts:read`, `experts:contact`). Contact endpoint capped at 2-per-(customer, expert)-per-day; resulting `RecommendationRequest` rows expire after 30 days. Expert types are TECHNICAL/DEPLOYMENT only — the lawyer (LEGAL) directory was removed 2026-07 and every route carries an `expertTypes: { hasSome: EXPERT_TYPES }` guard so legacy LEGAL-only rows are never exposed
- **Gavel:** Dispute escalation via `POST /api/v1/agent/deals/:id/dispute`. DRC protocol at `gavel.todo.law`. Inbound webhook at `/api/webhooks/gavel` fails closed (503) when `GAVEL_WEBHOOK_SECRET` is unset; 401 on bad signature
- **Payments removed (Stripe dormant):** `features.stripeEnabled = !!process.env.STRIPE_SECRET_KEY`, so deleting `STRIPE_SECRET_KEY` turns Stripe (and `billing`, `selfServiceUpgrade`) off. With the key absent, `features.allSkillsFree` is automatically true regardless of the old `FREE_TRIAL_ALL_SKILLS` promo env. On the hosted deployment the key is deleted, so all skills are free. The commerce endpoints (`/api/checkout`, `/api/checkout/credits`, `/api/checkout/activate`, `/api/v1/agent/subscribe`) return a clean **409** `{ error: "Payments are disabled; all skills are free" }` instead of a 500. Stripe SDK and the webhook handler stay in the tree, dormant behind the flag.
- **Stripe webhook (when enabled):** inbound webhook at `/api/webhooks/stripe` is idempotent — claims `event.id` via `stripe_webhook_events` table on first delivery, subsequent redeliveries return 200 with `{ idempotent: true }` and skip the handler

## Operations

- **Health check:** `GET /api/health` — public endpoint, no auth. Returns `{ ok, time, commit, version, services: { database, databaseLatencyMs } }`. HTTP 200 when healthy, 503 when the database probe fails. `Cache-Control: no-store` so any uptime monitor reads fresh. Useful for UptimeRobot / BetterStack / a quick `curl` smoke test after deploy. The sovereign `docker-compose.yml` wires a container healthcheck against this endpoint (`wget` to `/api/health`), so `docker compose ps` reflects real Postgres readiness.
- **Daily cron:** `GET /api/cron/daily` — scheduled in `vercel.json` for 09:00 UTC every day. Runs three jobs: signing reminder (3 days before expiry), signing expiry (mark `EXPIRED` + revert deal to AGREED + email both parties), recommendation-request expiry (mark `CANCELLED`). Protected by `CRON_SECRET` env var — fails closed with 503 if unset.
- **Marketplace and billing pages disabled** while payments are off. `features.marketplace = false` (a priced catalog is incoherent when everything is free), and `features.billing` follows `STRIPE_SECRET_KEY`. Both `/marketplace` (`src/app/(dashboard)/marketplace/layout.tsx`) and `/billing` (`src/app/(dashboard)/billing/layout.tsx`) call `notFound()` when their flag is off, and the footer links are hidden. Restore by flipping `marketplace` back to `true` and/or setting `STRIPE_SECRET_KEY`.
- **All skills free, no promo env needed.** `features.allSkillsFree` is true whenever `STRIPE_SECRET_KEY` is absent, which is the permanent hosted state. The legacy promo path (`FREE_TRIAL_ALL_SKILLS` server-only, `NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS` server + client) is retained only to open a free window while Stripe stays configured; the public-prefixed variant is what drives the client `<PromoBanner>`, since Next.js only inlines `NEXT_PUBLIC_*` into the browser bundle. With Stripe deleted, none of these are set and every skill is free by default.
- **Tester quick-access mode:** set **both** `TESTER_MODE_ENABLED=true` (server) and `NEXT_PUBLIC_TESTER_MODE=true` (client) on Vercel to expose three one-click sign-in buttons on `/sign-in` for the fictitious users `tester-startup@todo.law`, `tester-lawyer@todo.law`, `tester-business@todo.law`. Only those three emails are accepted by the `tester` credentials provider — there's no password, the allowlist is the gate. Signed-in tester users see a floating `<TesterBar>` with a "Reset my data" button that POSTs to `/api/tester/reset` to wipe their deals, invitations, signing artefacts and audit logs (the user record itself stays so the session keeps working). Reset is opt-in to support multi-party flow testing where state needs to persist between sign-ins. Disable by unsetting both env vars.

## Commands
```bash
npx prisma db seed                                  # Seed built-in skills only
SKILLS_DIR=/path/to/legalskills npx prisma db seed  # Seed built-in + premium
npm run deal:simulate                               # Create demo deals (idempotent)
npm run deal:simulate -- --clean                    # Recreate all demo deals
npm test                                            # Vitest watch mode (unit tests for lib/)
npm run test:run                                    # Vitest single run (use in CI)
npm run check:api                                   # Static guard: no raw errors leaked from /api/* routes
npm run check:skills                                # Static guard: skill JSON shape (i18n, [BRACKET] leaks, {curly} vars, biases)
SKILLS_DIR=/path/to/legalskills npm run check:skills # Same guard on the extended repo
npm run skills:manifest                             # Write a hash manifest of seeded skills
npm run skills:diff                                 # Drift check: seeded DB vs. manifest (see docs/skills-sync.md)
```

## Quality Infra (P1)

- **CI:** `.github/workflows/ci.yml` runs on push to `main`/`p1-consistency` and on PRs to `main`. It provisions a throwaway `postgres:16` service (the `build` step runs `prisma migrate deploy`, which needs a real DB) and runs, in order: `lint`, `tsc --noEmit`, `check:api`, `check:skills`, `test:run`, `build`.
- **Tests (~13, Vitest):** `src/**/__tests__/` and co-located `*.test.ts`. Cover router scoping (`server/routers/__tests__/deal.test.ts`), the 2FA verify gate (`app/api/__tests__/two-fa-verify-*.test.ts`), licensing/entitlement, feature flags, idempotency, crypto, equity/compromise, api-response and format-error. Run locally with `npm run test:run`.
- **Sovereign migrator self-heal:** `deploy/sovereign/migrate.sh` recovers a half-initialized DB (schema present but never baselined, Prisma error **P3005**) by resolving migrations as already-applied, so the container comes up instead of crash-looping. See `deploy/sovereign/README.md`.
- **Skills drift tooling:** `skills:manifest` / `skills:diff` (`scripts/skills-sync.mjs`) catch divergence between the seeded catalog and the tracked manifest. Doctrine in `docs/skills-sync.md`.
- **Governance files:** `SECURITY.md`, `CONTRIBUTING.md`, `NOTICES.md`, `CHANGELOG.md` at repo root. The app footers render an AGPL §13 "Source code" offer (compliance for the AGPL-3.0-or-later license).

## Deployment

- **Vercel** project `deal-room-todo` under `serges-projects-bffa7cfa`
- Build: `prisma migrate deploy && prisma generate && next build`
- Database: Neon PostgreSQL (pooled URL for app, unpooled for migrations/seed)
- Schema changes: create migrations with `prisma migrate dev`, deploy via Vercel build
- Skill data: seed via legalskills workflow or manually (see "Seeding Skills" above)

## E2E Testing (Playwright)

- Auth bypass: `e2e-credentials` provider gated by `E2E_CREDENTIALS_SECRET`
- Helpers: `e2e/helpers/auth.ts` (login), `e2e/helpers/deal.ts`, `e2e/helpers/lifecycle.ts`
- Smoke test: `e2e/smoke-new-deal.spec.ts` — 8 scenarios across all 5 free contract types × jurisdictions × languages × modes
- Handles `soloModeOnly` types (Privacy Notice) which skip jurisdiction/mode steps and have required deal parameters
- Run: `npx playwright test e2e/smoke-new-deal.spec.ts --project=desktop`

## Deal Creation Flow

- Steps: Contract Type → Jurisdiction → Language → Mode → Deal Details (+ Parameters)
- `soloModeOnly` types (Privacy Notice) skip jurisdiction and mode selection
- `soloModeSupported` / `soloModeDefault` flags control mode selector visibility
- "Proceed without lawyer" warning modal hidden for `LAWYER` role users
- Create button text: "Continue" (EN) / "Continuar" (ES)

## Jurisdiction-specific flows

Some flows only make sense in a single jurisdiction. Gate them on **`useLocale()`** (the user's chosen UI language), not on geo-IP. Locale is a cleaner intent signal: a Spanish-locale user in the US still wants Spanish-relevant flows; an English-locale user in Spain is fine seeing US-only flows.

Three places to close every entry point:
1. **Dashboard nav** — wrap the nav item declaration in `locale !== "es"` (or whatever inverse condition fits)
2. **Empty-state cards** that surface the feature on `/deals` (and elsewhere)
3. **A route-level `layout.tsx`** that redirects to `/deals` when the locale doesn't match — closes bookmarks, shared links, and mid-flow locale switches

Current example: `/launch` (Delaware C-Corp formation) is hidden from `locale === "es"`. See commit `86b228d` and the `(dashboard)/launch/layout.tsx` redirect. If a Spanish-jurisdiction founder journey ships later (e.g., S.L. constitution), it goes alongside as a separate `templateFamily` with its own locale gate — don't try to multiplex one flow across jurisdictions.

## Public Docs (`/docs`)

- Skills & Licensing, Compromise Algorithm, How It Works, Supervision
- Agent API reference, A2A Skills Catalog (dynamic, queries DB for `A2A_` templates)
- **Agent Preparation Guide:** `/docs/agent-preparation/` — policy authoring, playbook builder (dynamic), dispute readiness with Gavel DRC
- All docs pages bilingual EN/ES via `useTranslations()`. Layout: `src/app/(public)/docs/layout.tsx`

## SEO / Indexing

- Google Search Console verification: `src/app/google700a816d5db3f2da.html/route.ts` (inline, not static file)
- `public/sitemap.xml` — public pages only (no auth-gated routes like `/marketplace`)
- `public/robots.txt`, `public/llms.txt` — crawling/LLM guidance

## Security

- **2FA verify hardened (P0):** the admin and supervisor 2FA verify endpoints now check a server-side TOTP before setting the gate cookie, so the cookie can no longer be set without a valid code. Covered by `app/api/__tests__/two-fa-verify-*.test.ts`.
- **Fixtures scrubbed (P0):** real PII was replaced with fictional fixtures, and a real leaked API key committed in the tree was redacted.
- **Rotations owed (open):** Resend, NextAuth secret, Google OAuth, Neon, the `drk_` demo key (already revoked at `/admin/customers`), and webhook secrets still need rotating. **Stripe keys were deleted (payments removed), not rotated.** Nothing to rotate once the key is gone.

## Conventions

- **Brand name:** Always "Dealroom" (one word), never "Deal Room"
- **Skill ID namespace:** Skill packages use the reverse-DNS namespace `com.nel.skills.<name>` (regex enforced in `src/server/services/skills/validator.ts:27`). The `nel` here is a **stable namespace identifier**, not a brand reference — it predates the NEL deployment and survives the 2026-05-02 brand consolidation. Every `SkillPackage.skillId` row in production matches this pattern. Do not rename it during future cleanups.
- **i18n:** Castilian Spanish only, never Latin American. "skills" as loanword. Gender-inclusive ("abogado/a")
- **Boilerplate:** No `[BRACKET]` placeholders. Don't duplicate negotiable topics in standardClauses
- **Prisma client:** always import from `@/lib/prisma` (extended with Neon retry wrapper). Helpers accepting a client must type it as `ExtendedPrismaClient` from that module — not raw `PrismaClient`.
- **API route error handling:** every `/api/*` handler that touches `prisma` must wrap its body in try/catch and return `apiError(error, "fallback message")` from `@/lib/api-response`. Never return raw `error.message` in a `NextResponse` — the `check:api` guard flags it. Transient Neon errors become 503 + "We're reconnecting..."; everything else becomes 500 + the fallback. tRPC procedures get this automatically via the `errorFormatter`.
