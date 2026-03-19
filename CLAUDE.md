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

## Skills

- **Free (5):** `skills/` — nda, msa, saas, dpa, privacy-notice
- **Premium (27):** Private `RINDOGATAN/legalskills` repo — **never commit to this repo**
- All 32 bilingual EN/ES, 3 jurisdictions (CALIFORNIA, ENGLAND_WALES, SPAIN)
- Seed defaults `biasPartyA`/`biasPartyB` to `0` when missing

## APIs

- **Agent:** `/api/v1/agent/` — playbooks, negotiation, deals, webhooks, credits, MCP/A2A. Docs: `docs/agent-api.md`
- **Experts:** `/api/v1/experts/` — search, get-by-ID, contact. Auth: `drk_...` tokens with scopes

## Commands
```bash
npx prisma db seed                                  # Seed built-in skills
SKILLS_DIR=/path/to/legalskills npx prisma db seed  # Seed built-in + premium
npm run deal:simulate                               # Create demo deals
npm run deal:simulate -- --clean                    # Recreate all demo deals
```

## Conventions

- **Brand name:** Always "Dealroom" (one word), never "Deal Room"
- **i18n:** Castilian Spanish only, never Latin American. "skills" as loanword. Gender-inclusive ("abogado/a")
- **Boilerplate:** No `[BRACKET]` placeholders. Don't duplicate negotiable topics in standardClauses
