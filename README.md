# Dealroom

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Two-party async contract negotiation platform with weighted compromise algorithm.

## Features

- **Contract Negotiation** — Structured clause-by-clause negotiation workflow
- **Weighted Compromise** — Algorithm suggests fair compromises based on party firmness and option bias
- **Skills Marketplace** — Licensed contract templates (NDA, DPA, MSA, etc.)
- **Multilingual Support** — Cross-language negotiation (Party A in English, Party B in Spanish)
- **Two-Level Admin** — Platform admins manage marketplace; supervisors monitor deals
- **Multi-Brand Deployment** — Single codebase, multiple brands via environment variables

## Brands

| Brand | Domain | Auth | UI |
|-------|--------|------|----|
| **TODO.LAW** (default) | `dealroom.todo.law` | Magic-link + Google | Rounded blue |
| **North End Law** | `dealroom.northend.law` | Invite-code + Google | Brutalist teal |

Set `NEXT_PUBLIC_BRAND=todo` or `NEXT_PUBLIC_BRAND=northend` to select brand. See [docs/deployment.md](docs/deployment.md) for full multi-brand architecture.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **API:** tRPC
- **Database:** PostgreSQL + Prisma
- **Auth:** NextAuth (magic link, invite code, Google OAuth)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Resend account (for magic link emails)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Push database schema
npx prisma generate && npx prisma db push

# Seed initial data
npx prisma db seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the app.

To run as a different brand:

```bash
NEXT_PUBLIC_BRAND=northend npm run dev
```

### Environment Variables

```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_BRAND=todo              # todo | northend
RESEND_API_KEY=...
EMAIL_FROM=noreply@yourdomain.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SKILLS_DIR=/path/to/skills          # Optional: premium skills directory
STRIPE_SECRET_KEY=...               # Optional: enables billing
```

## Administration

### Create Platform Admin

```bash
npm run admin:create -- --email=admin@example.com --name="Admin Name"
```

Access the platform admin portal at `/admin`.

### Create Supervisor

```bash
npm run supervisor:create -- --email=supervisor@lawfirm.com --name="Jane Smith"
```

Or create via the admin portal at `/admin/supervisors`.

Supervisors access their portal at `/supervise` and can only view deals assigned to them.

## Documentation

| Document | Description |
|----------|-------------|
| [deployment.md](docs/deployment.md) | Multi-brand architecture, Vercel setup, environment variables |
| [administration.md](docs/administration.md) | Two-level admin system, deal lifecycle, signing |
| [lawyer-involvement.md](docs/lawyer-involvement.md) | Three stages of lawyer involvement (EN) |
| [intervencion-abogado.md](docs/intervencion-abogado.md) | Tres fases de intervención de abogado/a (ES) |
| [agent-api.md](docs/agent-api.md) | Agent Negotiation REST API reference |
| [skills-and-licensing.md](docs/skills-and-licensing.md) | Skill packages, licensing, activation, i18n |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (admin)/           # Platform admin portal
│   ├── (supervisor)/      # Supervisor portal
│   ├── (dashboard)/       # User dashboard
│   └── api/               # API routes
├── components/            # React components
├── config/
│   ├── brand.ts           # Brand router
│   ├── brands/            # Per-brand config (todo.ts, northend.ts)
│   └── features.ts        # Feature flags
├── lib/                   # Shared utilities
└── server/
    ├── routers/           # tRPC routers
    └── services/          # Business logic
prisma/
├── schema.prisma          # Database schema
└── seed.ts               # Seed data
skills/                    # Built-in contract templates
docs/                      # Documentation
```

## Key Concepts

### Deal Flow

1. **Create** — Initiator creates deal, selects skill and jurisdiction
2. **Invite** — Respondent receives invitation link
3. **Submit** — Both parties submit clause preferences and firmness levels
4. **Negotiate** — Algorithm suggests compromises; parties can also propose changes to open fields (negotiable parameters)
5. **Agree** — Parties accept final terms
6. **Sign** — Contract generated for signing

### Compromise Algorithm

```
stake = ((5-flexibility)/5 × 0.6) + (|bias| × 0.4)
```

Each party sets a **firmness** level (1–5) per clause; the UI shows firmness while the database stores flexibility (6 − firmness). The party with higher stake wins the clause; equal stakes trigger a balanced compromise. A global fairness pass rebalances if one party wins disproportionately.

### Administration Levels

| Role | Portal | Access |
|------|--------|--------|
| Platform Admin | `/admin` | Manage marketplace, customers, supervisors |
| Supervisor | `/supervise` | Monitor assigned deals only |
| User | `/deals` | Own negotiations only |

## License

Copyright (c) 2025-2026 Rindogatan LLC

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
