# Deal Room

Two-party async contract negotiation with weighted compromise algorithm.

**Stack:** Next.js 14 | TypeScript | tRPC | PostgreSQL + Prisma | NextAuth
**Domain:** dealroom.todo.law | Auth cookie domain: `.todo.law`

## Key Paths
```
skills/                         # Built-in free skills (e.g. DPA)
prisma/schema.prisma            # Data model
prisma/seed.ts                  # Seeds built-in + external skills
src/server/routers/             # tRPC routers
src/server/services/skills/     # Skill loading & i18n
src/server/services/licensing/  # Entitlement checks
src/lib/auth.ts                 # NextAuth config (cookie domain here)
docs/administration.md          # Full admin & skills docs
```

## Administration

| Portal | URL | Auth |
|--------|-----|------|
| **Platform Admin** | `/admin` | `auth-admin.ts` → `PlatformAdmin` table |
| **Supervisor** | `/supervise` | `auth-supervisor.ts` → `Supervisor` table |

## Skills

**Built-in** (free, in `skills/` directory — no manifest.json):
- DPA (Data Processing Agreement)

**Licensed** (private `legalskills` repo, require `manifest.json` + entitlement):

| Skill | ID |
|-------|-----|
| Founders Agreement | `com.nel.skills.founders` |
| SAFE Agreement | `com.nel.skills.safe` |
| Pacto de Socios | `com.nel.skills.pacto-socios` |

Admin assigns entitlements at `/admin/customers`.

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
