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
```

## Quick Reference

**Compromise:** `stake = (priority/5 * 0.4) + ((5-flexibility)/5 * 0.3) + (|bias| * 0.3)`

**Enums:** `GoverningLaw`: CALIFORNIA, ENGLAND_WALES, SPAIN

**Fonts:** Inter (body), Jost (metrics via `.metric` classes), Dancing Script (signatures)
