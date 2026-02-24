# Deal Room

Two-party async contract negotiation with weighted compromise algorithm.

**Stack:** Next.js 14 | TypeScript | tRPC | PostgreSQL + Prisma | NextAuth
**Domain:** dealroom.todo.law | Auth cookie domain: `.todo.law`

## Key Paths
```
skills/                         # Built-in free skills (e.g. DPA)
prisma/schema.prisma            # Data model
prisma/seed.ts                  # Seeds built-in + external skills + supervisor
src/server/routers/             # tRPC routers
src/server/services/skills/     # Skill loading & i18n
src/server/services/licensing/  # Entitlement checks
src/lib/auth.ts                 # NextAuth config (cookie domain here)
src/lib/email.ts                # Resend emails (invitation, client invite, attorney review)
src/lib/parameters.ts           # Deal parameter types + [token] interpolation
docs/administration.md          # Full admin, skills, lifecycle & signing docs
```

## Administration

| Portal | URL | Auth |
|--------|-----|------|
| **Platform Admin** | `/admin` | `auth-admin.ts` → `PlatformAdmin` table |
| **Supervisor** | `/supervise` | `auth-supervisor.ts` → `Supervisor` table |

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
```

## Quick Reference

**Compromise:** `stake = (priority/5 * 0.4) + ((5-flexibility)/5 * 0.3) + (|bias| * 0.3)`

**Enums:** `GoverningLaw`: CALIFORNIA, ENGLAND_WALES, SPAIN

**Fonts:** Inter (fallback), Jost (body/metrics via `--font-display`), Archivo Black (headings via `--font-heading`), Dancing Script (signatures)

**Mobile:** All grids use `grid-cols-1` base with `sm:` or `md:` breakpoints. Buttons use icon-only on mobile where text overflows. Dashboard header uses `backdrop-blur-sm` for mobile GPU performance.

**Parameters:** Skills define parameters in `parameters.json`. Two interpolation modes: `[bracket]` tokens in clause legal text, `{curly}` variables in boilerplate. Token names are localized (e.g. `amount` → `importe` in Spanish). Values stored on `DealRoom.parameters` JSON field.

**Simulate:** `npm run deal:simulate` runs full lifecycle for all contract types (DPA, NDA, MSA, SAAS, SEED_INVESTMENT) with 14 validation checks per deal including unresolved placeholder detection.
