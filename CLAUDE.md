# Dealroom

Contract negotiation platform with weighted compromise algorithm. Supports solo mode (single-party) and two-party negotiation.

**Stack:** Next.js 14 | TypeScript | tRPC | PostgreSQL + Prisma | NextAuth
**Build:** `prisma migrate deploy && prisma generate && next build`

| Brand | Domain | Auth | UI |
|-------|--------|------|----|
| `todo` (default) | dealroom.todo.law | Magic-link + Google | Rounded blue (#53aecc) |
| `northend` | dealroom.northend.law | Invite-code + Google | Brutalist teal (#13e9d1) |

## Deal Lifecycle

**Statuses:** DRAFT → AWAITING_RESPONSE → NEGOTIATING → AGREED → SIGNING → COMPLETED (+ CANCELLED)

**Modes:** `NEGOTIATION` (two-party, weighted compromise) | `SOLO` (single-party, direct clause selection)

**Compromise:** `stake = ((5-flexibility)/5 * 0.6) + (|bias| * 0.4)` — UI shows "firmness" (= 6 - flexibility).

**Lawyer involvement:** Attorney review (tRPC `attorneyReview` router), joint counsel (`jointCounsel` router), supervisor vetting (`LawyerVetting` model). Lawyers discoverable via Expert directory.

**Signing:** Three providers — type-to-sign (in-app), DocuSign, HelloSign. Managed via `SigningRequest` model.

## Skills (Open-Core Model)

- **Free (5):** `skills/` dir — nda, msa, saas, dpa, privacy-notice
- **Premium (27):** Private [`RINDOGATAN/legalskills`](https://github.com/RINDOGATAN/legalskills) repo — requires `manifest.json` + `SkillEntitlement` + Stripe license
- **All 32 skills** are bilingual EN/ES, 3 jurisdictions (CALIFORNIA, ENGLAND_WALES, SPAIN). Spanish-only corporate docs (acta-consejo, acta-junta) by design.
- Auto-seed: `legalskills/.github/workflows/seed.yml` runs on push to skill files
- **Never commit premium skills to this repo**
- Seed defaults `biasPartyA`/`biasPartyB` to `0` when missing from clauses.json

## Key Paths
```
src/config/brand.ts             # Brand router (NEXT_PUBLIC_BRAND)
src/config/features.ts          # Feature flags (12 flags, brand + env driven)
skills/                         # Built-in free skills
prisma/schema.prisma            # Data model
prisma/seed.ts                  # Seeds skills + supervisor
src/server/routers/             # tRPC routers
src/server/services/skills/     # Skill loading & i18n
src/server/services/licensing/  # Entitlement checks
src/server/services/document/   # PDF generation
src/lib/parameters.ts           # Deal parameters + [token] interpolation
docs/administration.md          # Full admin, skills catalog, lifecycle & signing docs
docs/agent-api.md               # Agent API documentation
```

## Parameters

Two interpolation modes: `[bracket]` tokens in clause text, `{curly}` variables in boilerplate. The `boilerplateVariable` field in parameters.json bridges parameters to boilerplate variables. Built-in variables (no parameter needed): `{effectiveDate}`, `{partyAName}`, `{partyBName}`, `{partyAAddress}`, `{partyBAddress}`, `{partyASignatureBlock}`, `{partyBSignatureBlock}`.

## APIs

**Agent API:** 22 REST endpoints at `/api/v1/agent/` — playbooks, negotiation, deals, webhooks, credits, MCP/A2A discovery. Feature-gated: `features.agentApi`. Docs: `docs/agent-api.md`.

**Experts API:** `/api/v1/experts/` — search, get-by-ID, contact requests. Auth: Bearer `drk_...` tokens with scopes. Feature-gated: `features.expertsApi`.

## Commands
```bash
npx prisma db seed                                  # Seed built-in skills only
SKILLS_DIR=/path/to/legalskills npx prisma db seed  # Seed built-in + premium
npm run admin:create                                # Create platform admin
npm run deal:simulate                               # Create demo deals (idempotent)
npm run deal:simulate -- --clean                    # Recreate all demo deals
SKILLS_DIR=/path/to/legalskills npm run skill:build # Build .skill packages
npm run skill:upload                                # Upload .skill to Vercel Blob
```

## Conventions

- **Brand name:** Always "Dealroom" (one word), never "Deal Room"
- **i18n:** Spanish must be Castilian (Spain), never Latin American. Use "skills" as loanword. Gender-inclusive forms ("abogado/a").
- **Fonts:** Jost (body), Archivo Black (headings), Dancing Script (signatures)
- **Mobile:** `grid-cols-1` base with `sm:`/`md:` breakpoints
- **Boilerplate:** No `[BRACKET]` placeholders in boilerplate files. Avoid duplicating negotiable clause topics in standardClauses.
- **Skill packages:** `.skill` ZIP files (manifest.json + content/ + parameters.json + signature.sig)
