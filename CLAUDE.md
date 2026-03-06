# Deal Room

Two-party async contract negotiation with weighted compromise algorithm.

**Stack:** Next.js 14 | TypeScript | tRPC | PostgreSQL + Prisma | NextAuth
**Deployment:** Two Vercel projects → same repo, `NEXT_PUBLIC_BRAND` env var selects brand
**Build:** `prisma migrate deploy && prisma generate && next build` (migrations run automatically on deploy)

| Brand | Domain | Auth | UI |
|-------|--------|------|----|
| `todo` (default) | dealroom.todo.law | Magic-link + Google | Rounded blue (#53aecc) |
| `northend` | dealroom.northend.law | Invite-code + Google | Brutalist teal (#13e9d1) |

## Key Paths
```
src/config/brand.ts             # Brand router (reads NEXT_PUBLIC_BRAND)
src/config/brands/todo.ts       # todo.law brand config
src/config/brands/northend.ts   # northend.law brand config
src/config/features.ts          # Feature flags (brand + env driven)
skills/                         # Built-in free skills (e.g. DPA)
prisma/schema.prisma            # Data model (includes InviteCode)
prisma/seed.ts                  # Seeds built-in + external skills + supervisor
src/server/routers/             # tRPC routers
src/server/services/skills/     # Skill loading & i18n
src/server/services/licensing/  # Entitlement checks
src/lib/auth.ts                 # NextAuth config (conditional providers per brand)
src/lib/email.ts                # Resend emails (brand-dynamic templates)
src/lib/parameters.ts           # Deal parameter types + [token] interpolation
docs/administration.md          # Full admin, skills, lifecycle & signing docs
```

## Administration

| Portal | URL | Auth |
|--------|-----|------|
| **Platform Admin** | `/admin` | `auth-admin.ts` → `PlatformAdmin` table |
| **Supervisor** | `/supervise` | `auth-supervisor.ts` → `Supervisor` table |

## Brand System

- `brand.ts` imports from `brands/todo.ts` or `brands/northend.ts` based on `NEXT_PUBLIC_BRAND`
- `features.ts` gates features by brand: `lawyerInvolvement`, `marketplace`, `billing`, `agentApi`, `expertsApi`, `publicDocs`, `clientInvitations`
- CSS theming via `data-brand` attribute on `<html>` — `[data-brand="northend"]` overrides variables + component classes
- Northend: 0 radii, no shadows, no noise texture, headings use body font, amber destructive
- Route-level feature gates via `layout.tsx` files that call `notFound()`
- API v1 routes check `features.agentApi` and return 404 when disabled

## Skills (Open-Core Model)

- **Free:** Any skill in `skills/` without a `manifest.json` — available to all users
- **Premium:** Any skill with a `manifest.json` — requires `SkillEntitlement` + active license
- Premium skills live in the private `legalskills` repo; seeded via `SKILLS_DIR` env var
- Admin assigns entitlements at `/admin/customers`

## Commands
```bash
npx prisma db seed                                # Seed built-in skills only
SKILLS_DIR=/path/to/legalskills npx prisma db seed  # Seed built-in + licensed
npm run admin:create                              # Create platform admin
npm run deal:simulate                             # Create demo deals (idempotent)
npm run deal:simulate -- --clean                  # Recreate all demo deals from scratch
SKILLS_DIR=/path/to/legalskills npm run skill:build             # Build .skill packages → dist/
SKILLS_DIR=/path/to/legalskills npm run skill:build skill-name  # Build specific skill(s)
npm run skill:upload                              # Upload dist/*.skill to Vercel Blob
```

## Cross-Product Experts Directory API

Exposes the lawyer/expert directory to other TodoLaw apps (DPO Central, VendorWatch, AI Sentinel).

**Endpoints:**
- `POST /api/v1/experts/search` — filtered search with pagination
- `GET /api/v1/experts/:id` — single profile by user ID

**Auth:** Bearer token (`drk_...`) with scope `experts:read`. Keys issued per customer via `/admin/customers/[id]`.

**Base URL (production):** `https://dealroom.todo.law/api/v1/experts`

**Feature flag:** `features.expertsApi` (brand-gated to `todo`)

**Key files:**
```
src/app/api/v1/experts/search/route.ts   # Search endpoint
src/app/api/v1/experts/[id]/route.ts     # Get-by-ID endpoint
src/server/services/experts/taxonomy.ts  # Specializations, certifications, completeness score
src/app/(admin)/admin/experts/page.tsx   # Admin UI for managing expert profiles
```

**LawyerProfile extended fields** (added via migration `20260305000000`):
`title`, `expertType` (LEGAL/TECHNICAL/BOTH), `specializations[]`, `certifications[]`, `countryCode`, `city`, `jurisdictionsCovered[]`, `contactUrl`, `acceptingClients`

**Taxonomy:** 16 specializations + 10 certifications defined as controlled vocabularies in `taxonomy.ts`, validated at app layer (not Prisma enums) for flexibility.

**Admin onboarding flow:** `/admin` → Experts → New Expert → pick user → fill fields → save. Also editable from the lawyer self-service profile at `/lawyers/profile`.

**Consumer caching guidance:** Search results cached 5 min, individual profiles 1 hour (consumer-side).

## Quick Reference

**Compromise:** `stake = (priority/5 * 0.4) + ((5-flexibility)/5 * 0.3) + (|bias| * 0.3)`

**Enums:** `GoverningLaw`: CALIFORNIA, ENGLAND_WALES, SPAIN

**Fonts:** Inter (fallback), Jost (body/metrics via `--font-display`), Archivo Black (headings via `--font-heading`), Dancing Script (signatures)

**Mobile:** All grids use `grid-cols-1` base with `sm:` or `md:` breakpoints. Buttons use icon-only on mobile where text overflows. Dashboard header uses `backdrop-blur-sm` for mobile GPU performance.

**Parameters:** Skills define parameters in `parameters.json`. Two interpolation modes: `[bracket]` tokens in clause legal text, `{curly}` variables in boilerplate. Token names are localized (e.g. `amount` → `importe` in Spanish). Values stored on `DealRoom.parameters` JSON field.

**Simulate:** `npm run deal:simulate` runs full lifecycle for all contract types (DPA, NDA, MSA, SAAS, SEED_INVESTMENT, ADVERTISING_IO, AFFILIATE_PROGRAM) with 14 validation checks per deal including unresolved placeholder detection.

**Skill Packages:** Premium skills are distributed as `.skill` ZIP files (manifest.json + content/clauses.json + content/boilerplate.json + parameters.json + signature.sig). Build with `npm run skill:build`, upload with `npm run skill:upload`.
