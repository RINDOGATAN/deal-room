# Deal Room

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Two-party async contract negotiation platform with weighted compromise algorithm.

## Features

- **Contract Negotiation** - Structured clause-by-clause negotiation workflow
- **Weighted Compromise** - Algorithm suggests fair compromises based on party priorities
- **Skills Marketplace** - Licensed contract templates (NDA, DPA, MSA, etc.)
- **Multilingual Support** - Cross-language negotiation (Party A in English, Party B in Spanish)
- **Two-Level Admin** - Platform admins manage marketplace; supervisors monitor deals

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **API:** tRPC
- **Database:** PostgreSQL + Prisma
- **Auth:** NextAuth (magic link + 2FA for admins)

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

### Environment Variables

```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
RESEND_API_KEY=...
EMAIL_FROM=noreply@yourdomain.com
SKILLS_DIR=/path/to/skills
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

- `CLAUDE.md` - Quick reference for development
- `docs/skills-and-licensing.md` - Skill packages and licensing system
- `docs/administration.md` - Admin and supervisor portal documentation

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (admin)/           # Platform admin portal
│   ├── (supervisor)/      # Supervisor portal
│   ├── (dashboard)/       # User dashboard
│   └── api/               # API routes
├── components/            # React components
├── lib/                   # Shared utilities
└── server/
    ├── routers/           # tRPC routers
    └── services/          # Business logic
prisma/
├── schema.prisma          # Database schema
└── seed.ts               # Seed data
cli/
└── commands/             # CLI tools
docs/                     # Documentation
```

## Key Concepts

### Deal Flow

1. **Create** - Initiator creates deal, selects skill and jurisdiction
2. **Invite** - Respondent receives invitation link
3. **Submit** - Both parties submit clause preferences
4. **Negotiate** - Algorithm suggests compromises
5. **Agree** - Parties accept final terms
6. **Sign** - Contract generated for signing

### Compromise Algorithm

```
stake = (priority/5 × 0.4) + ((5-flexibility)/5 × 0.3) + (|bias| × 0.3)
```

Party with higher stake wins the clause; equal stakes trigger compromise.

### Administration Levels

| Role | Portal | Access |
|------|--------|--------|
| Platform Admin | `/admin` | Manage marketplace, customers, supervisors |
| Supervisor | `/supervise` | Monitor assigned deals only |
| User | `/deals` | Own negotiations only |

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
