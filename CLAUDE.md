# Dealroom

Contract negotiation platform with weighted compromise algorithm.

**Stack:** Next.js 14 | TypeScript | tRPC | PostgreSQL + Prisma | NextAuth
**Build:** `prisma migrate deploy && prisma generate && next build`
**Brands:** `todo` (dealroom.todo.law) | `northend` (dealroom.northend.law) — set via `NEXT_PUBLIC_BRAND`

## Core Concepts

**Statuses:** DRAFT → AWAITING_RESPONSE → NEGOTIATING → AGREED → SIGNING → COMPLETED (+ CANCELLED)
**Modes:** `NEGOTIATION` (two-party) | `SOLO` (single-party)
**Compromise:** `stake = ((5-flexibility)/5 * 0.6) + (|bias| * 0.4)` — UI shows "firmness" (= 6 - flexibility)
**Signing:** type-to-sign, DocuSign, HelloSign via `SigningRequest` model
**Parameters:** `[bracket]` tokens in clause text, `{curly}` variables in boilerplate. `boilerplateVariable` in parameters.json bridges the two.

## Skills (Open-Core Model)

- **Free (5):** `skills/` — nda, msa, saas, dpa, privacy-notice
- **Premium (27):** Private `RINDOGATAN/legalskills` repo — **never commit premium skills to this repo**
- All 32 bilingual EN/ES, 3 jurisdictions (CALIFORNIA, ENGLAND_WALES, SPAIN)
- Seed defaults `biasPartyA`/`biasPartyB` to `0` when missing

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
- **Experts:** `/api/v1/experts/` — search, get-by-ID, contact. Auth: `drk_...` tokens with scopes

## Commands
```bash
npx prisma db seed                                  # Seed built-in skills only
SKILLS_DIR=/path/to/legalskills npx prisma db seed  # Seed built-in + premium
npm run deal:simulate                               # Create demo deals (idempotent)
npm run deal:simulate -- --clean                    # Recreate all demo deals
```

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
- Lawyer hint and "proceed without lawyer" warning modal both hidden for `LAWYER` role users
- Lawyer directory filters to `expertTypes: { has: "LEGAL" }` (excludes deployment specialists)
- Create button text: "Continue" (EN) / "Continuar" (ES)

## Conventions

- **Brand name:** Always "Dealroom" (one word), never "Deal Room"
- **i18n:** Castilian Spanish only, never Latin American. "skills" as loanword. Gender-inclusive ("abogado/a")
- **Boilerplate:** No `[BRACKET]` placeholders. Don't duplicate negotiable topics in standardClauses
