# Administration System

This document explains Dealroom's two-level administration system for managing the platform and supervising negotiations.

---

## Overview

Dealroom uses a separation of concerns for administration:

| Role | Portal | Access | Purpose |
|------|--------|--------|---------|
| **Platform Admin** | `/admin` | Platform-wide | Manage marketplace, customers, supervisors |
| **Supervisor** | `/supervise` | Assigned deals only | Monitor and assist with negotiations |
| **User** | `/deals` | Own deals only | Party to negotiations |

The same email address can have access to multiple contexts simultaneously.

---

## Platform Admin Portal

### Access

- **URL:** `/admin`
- **Login:** `/admin/sign-in` (magic link + 2FA)
- **Session cookie:** `admin_session`
- **2FA cookie:** `platform_admin_2fa_verified`

### Features

#### Dashboard (`/admin`)
- Customer count, deal count, skill count, supervisor count
- Deals by status breakdown
- Recent platform activity
- Quick links to management sections

#### Supervisor Management (`/admin/supervisors`)
- Create new supervisor accounts (email + name)
- View all supervisors with status
- Activate/deactivate supervisors
- See deal assignment counts per supervisor
- Manage bar admissions per supervisor (jurisdiction + bar number)
- Bar admissions control which deals a supervisor can review (Stage A and B jurisdiction filtering)

#### Deal Management (`/admin/deals`)
- View all deals platform-wide
- Filter and search deals
- Assign supervisors to deals
- Remove supervisor assignments

#### Customer Management (`/admin/customers`)
- View all customers
- Search by name or email
- See customer type (SaaS vs Self-Hosted)
- View entitlement counts

#### Skills Marketplace (`/admin/skills`)
- View installed skill packages
- See skill metadata (version, jurisdictions, languages)
- View entitlement counts per skill
- Activate/deactivate skills

#### Analytics (`/admin/analytics`)
- Total deals and completion rates
- Average negotiation rounds
- Active license count
- Deals by status, skill, and jurisdiction

### Creating a Platform Admin

```bash
npm run admin:create -- --email=admin@example.com --name="Admin Name"
```

Or via the CLI interactively:
```bash
npm run admin:create
```

---

## Supervisor Portal

### Access

- **URL:** `/supervise`
- **Login:** `/supervise/sign-in` (magic link + 2FA)
- **Session cookie:** `supervisor_session`
- **2FA cookie:** `supervisor_2fa_verified`

### Key Concept: Assignment-Based Access

Supervisors only see deals explicitly assigned to them by a Platform Admin. They cannot view all deals on the platform.

### Features

#### Dashboard (`/supervise`)
- List of assigned deals with status
- Quick stats (pending, negotiating, agreed)
- Search within assigned deals
- Empty state if no deals assigned

#### Deal Detail View (`/supervise/deals/[id]`)
- Full deal details (read-only)
- Clause-by-clause breakdown
- Party selections and positions (both sides visible)
- Compromise suggestions
- Audit log of all activity
- Stage A banner — "Party Counsel Review Requested/Approved" per party
- Stage B banner — "Joint Closing Counsel Pending/Active" with attorney details

### Creating a Supervisor

```bash
npm run supervisor:create -- --email=supervisor@lawfirm.com --name="Jane Smith"
```

Or via the Platform Admin portal at `/admin/supervisors`.

### Assigning Deals to Supervisors

1. Go to `/admin/deals` in the Platform Admin portal
2. Find the deal to assign
3. Click "Assign" button
4. Select supervisor from dropdown
5. Confirm assignment

Supervisors receive no notification for admin-initiated assignments — they simply see the deal when they next log in.

However, supervisors receive email notifications when:
- A **party requests attorney review** (Stage A) — link to the `/supervise` portal
- They are assigned as **joint closing counsel** (Stage B) — link to the `/supervise` portal

### Pre-Seeded Supervisor

The database seed (`prisma/seed.ts`) creates a default supervisory attorney:

| Field | Value |
|-------|-------|
| Email | `alex@example-firm.test` |
| Name | `Alex Ferris (#000000 State Bar of California)` |
| Active | `true` |

The seed also creates bar admissions for this supervisor:

| Jurisdiction | Bar Number |
|-------------|------------|
| CALIFORNIA | `000000` |
| SPAIN | `ICAM-00000` |

This is upserted on `email` / `supervisorId_jurisdiction`, so re-running `npx prisma db seed` is safe.

---

## Authentication Flow

### Platform Admin Login

```
/admin/sign-in
    ↓ Enter email (must be in PlatformAdmin table)
/admin/verify-request (magic link sent)
    ↓ Click link in email
/admin/verify (2FA code entry - first time shows QR setup)
    ↓ Valid TOTP code
/admin (dashboard)
```

### Supervisor Login

```
/supervise/sign-in
    ↓ Enter email (must be in Supervisor table)
/supervise/verify-request (magic link sent)
    ↓ Click link in email
/supervise/verify (2FA code entry - first time shows QR setup)
    ↓ Valid TOTP code
/supervise (dashboard with assigned deals)
```

### Two-Factor Authentication

Both admin types require TOTP-based 2FA:

1. **First login:** QR code displayed for authenticator app setup
2. **Subsequent logins:** Enter 6-digit code from authenticator
3. **Session duration:** 2FA verification stored in httpOnly cookie

Supported authenticator apps:
- Google Authenticator
- Authy
- 1Password
- Any TOTP-compatible app

---

## Database Schema

### Platform Admin

```prisma
model PlatformAdmin {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  twoFactorSecret AdminTwoFactor?
}

model AdminTwoFactor {
  id        String   @id @default(cuid())
  adminId   String   @unique
  secret    String
  verified  Boolean  @default(false)
  createdAt DateTime @default(now())

  admin PlatformAdmin @relation(...)
}
```

### Supervisor

```prisma
model Supervisor {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  twoFactorSecret   SupervisorTwoFactor?
  assignments       SupervisorAssignment[]
  barAdmissions     SupervisorBarAdmission[]
  jointCounselDeals DealRoom[]               @relation("JointCounsel")
}

model SupervisorTwoFactor {
  id           String   @id @default(cuid())
  supervisorId String   @unique
  secret       String
  verified     Boolean  @default(false)
  createdAt    DateTime @default(now())

  supervisor Supervisor @relation(...)
}

model SupervisorBarAdmission {
  id             String       @id @default(cuid())
  supervisorId   String
  jurisdiction   GoverningLaw
  barNumber      String

  supervisor Supervisor @relation(...)

  @@unique([supervisorId, jurisdiction])
}

model SupervisorAssignment {
  id           String   @id @default(cuid())
  supervisorId String
  dealRoomId   String
  assignedAt   DateTime @default(now())
  assignedBy   String?  // Platform admin who assigned

  supervisor Supervisor @relation(...)
  dealRoom   DealRoom   @relation(...)

  @@unique([supervisorId, dealRoomId])
}
```

---

## tRPC API Reference

### Platform Admin Router (`platformAdmin`)

| Procedure | Description |
|-----------|-------------|
| `getDashboardStats` | Dashboard statistics |
| `listSupervisors` | All supervisors with assignment counts and bar admissions |
| `createSupervisor` | Create new supervisor account |
| `toggleSupervisorActive` | Activate/deactivate supervisor |
| `addBarAdmission` | Add jurisdiction + bar number to supervisor |
| `removeBarAdmission` | Remove bar admission from supervisor |
| `assignSupervisor` | Assign supervisor to deal |
| `removeSupervisorAssignment` | Remove supervisor from deal |
| `listAllDeals` | All deals with supervisor assignments |
| `listCustomers` | All customers with search |
| `listSkillPackages` | All installed skills |
| `getAnalytics` | Platform-wide analytics |

### Platform Admin 2FA Router (`platformAdminTwoFactor`)

| Procedure | Description |
|-----------|-------------|
| `getStatus` | Check if admin and 2FA setup status |
| `setup` | Generate new TOTP secret and QR code |
| `verify` | Verify TOTP code |

### Supervisor Router (`supervisor`)

| Procedure | Description |
|-----------|-------------|
| `getAssignedDeals` | Deals assigned to this supervisor |
| `getDealDetails` | Full deal view (if assigned), includes joint counsel info |
| `approveReview` | Approve attorney review for a party |
| `getAuditLog` | Audit log for assigned deal |

### Supervisor 2FA Router (`supervisorTwoFactor`)

| Procedure | Description |
|-----------|-------------|
| `getStatus` | Check if supervisor and 2FA setup status |
| `setup` | Generate new TOTP secret and QR code |
| `verify` | Verify TOTP code |

---

## Session Management

### Cookie Strategy

| Cookie | Path | Purpose |
|--------|------|---------|
| `next-auth.session-token` | `/` | Regular user session |
| `supervisor_session` | `/` | Supervisor session |
| `supervisor_2fa_verified` | `/` | Supervisor 2FA status |
| `admin_session` | `/` | Platform admin session |
| `platform_admin_2fa_verified` | `/` | Admin 2FA status |

### Middleware Protection

Routes are protected via Next.js middleware:

- `/admin/*` requires `admin_session` + `platform_admin_2fa_verified`
- `/supervise/*` requires `supervisor_session` + `supervisor_2fa_verified`
- Auth pages (`/sign-in`, `/verify`, `/verify-request`) are excluded

---

## CLI Commands

### Create Platform Admin

```bash
npm run admin:create -- --email=admin@example.com --name="Admin Name"
```

Options:
- `--email` (required): Admin email address
- `--name` (optional): Display name

### Create Supervisor

```bash
npm run supervisor:create -- --email=supervisor@lawfirm.com --name="Jane Smith"
```

Options:
- `--email` (required): Supervisor email address
- `--name` (optional): Display name

---

## Security Considerations

### Authentication Security

- Magic link tokens expire after single use
- 2FA secrets stored encrypted in database
- Session cookies are httpOnly and secure in production
- Separate session namespaces prevent cookie confusion

### Authorization Security

- Platform admins can only be created via CLI (not self-registration)
- Supervisors can only be created by platform admins
- Supervisor access is strictly limited to assigned deals
- All admin actions are logged in audit trail

### Best Practices

1. Use strong, unique TOTP secrets
2. Store backup codes securely
3. Regularly audit supervisor assignments
4. Monitor admin activity logs
5. Use separate email addresses for different roles if possible

---

## Troubleshooting

### "Not authorized as a platform administrator"

**Cause:** Email not in PlatformAdmin table.

**Solution:** Create admin via CLI:
```bash
npm run admin:create -- --email=your@email.com
```

### "Not authorized as a supervisor"

**Cause:** Email not in Supervisor table.

**Solution:** Create via Platform Admin portal at `/admin/supervisors`.

### "2FA verification required"

**Cause:** Valid session but 2FA cookie missing or expired.

**Solution:** Re-enter TOTP code at `/admin/verify` or `/supervise/verify`.

### Supervisor sees no deals

**Cause:** No deals assigned to this supervisor.

**Solution:** Platform admin must assign deals at `/admin/deals`.

### Magic link not received

**Causes:**
1. Email not in correct admin/supervisor table
2. Email service (Resend) not configured
3. Email in spam folder

**Solution:** Check email configuration and database records.

---

## Deal Lifecycle

A deal moves through six statuses from creation to completion:

```
DRAFT → SUBMITTED → AWAITING_RESPONSE → NEGOTIATING → AGREED → SIGNING → COMPLETED
```

### Deal Creation (`/deals/new`)

The initiating party walks through up to five steps:

| Step | Field | Notes |
|------|-------|-------|
| 1 | **Contract type** | Skill selection, filtered by locale; premium skills gated by entitlement |
| 2 | **Governing law** | California, England & Wales, or Spain; locked after creation |
| 3 | **Contract language** | `en` or `es`; constrained by jurisdiction + skill support |
| 4 | **Deal details** | Deal name (required), company (optional) |
| 5 | **Deal parameters** | Only shown for skills that ship a `parameters.json` |

After creation the deal enters DRAFT and the initiator lands on `/deals/[id]/negotiate`.

### Deal Parameters

Some contracts require deal-specific values — monetary amounts, dates, geographic scope, etc. These are defined per-skill in `parameters.json` and come in two flavors:

- **Non-negotiable parameters** — filled in by the initiator at deal creation (Step 5). These values are fixed and appear directly in the contract.
- **Negotiable parameters** (`"negotiable": true`) — set initially by the initiator, but either party can propose changes during the review phase. Proposals include the new value and an optional rationale; the other party accepts or rejects each independently.

#### Parameter Types

| Type | Input | Example |
|------|-------|---------|
| `text` | Free text | Geographic area, project description |
| `currency` | Number with jurisdiction-aware symbol ($, £, €) | Investment amount, base fee |
| `number` | Numeric | Number of months, headcount |
| `percentage` | Number with % suffix | Discount rate, equity percentage |
| `date` | Date picker | Start date, maturity date |
| `choice` | Pill selector from predefined options | Arbitration institution |
| `multiSelect` | Multi-toggle from predefined options | Covered jurisdictions |

#### `parameters.json` Format

```json
{
  "version": "1.0",
  "parameters": [
    {
      "id": "investment-amount",
      "token": "amount",
      "scope": "investment-amount-clause",
      "type": "currency",
      "required": true,
      "negotiable": true,
      "label": { "en": "Investment Amount", "es": "Importe de la Inversión" },
      "hint": { "en": "Total investment in this round", "es": "Inversión total en esta ronda" },
      "placeholder": { "en": "e.g., 500000", "es": "ej., 500000" },
      "boilerplateVariable": "investmentAmount"
    }
  ]
}
```

- **`token`** — matches `[bracket]` placeholders in clause `legalText`
- **`scope`** — clauseId the parameter applies to, or `"*"` for skill-wide
- **`boilerplateVariable`** — also injects the value into `{curly}` boilerplate placeholders

#### Token Interpolation

At render time (negotiate UI, PDF, DOCX), `[bracket]` tokens in clause legal text are replaced with user-supplied values. Tokens are automatically translated for non-English contracts (e.g., `[amount]` → `[importe]` in Spanish).

#### Negotiable Parameter Flow

Parameters with `"negotiable": true` can be proposed and negotiated during the review phase:

1. **Propose** — Either party clicks "Propose Change" on a negotiable parameter, enters a new value and optional rationale
2. **Review** — The other party sees the proposal with current → proposed value comparison and the rationale
3. **Respond** — The other party accepts (value is updated immediately) or rejects (original value preserved)
4. **History** — All proposals and responses are logged in the negotiation history timeline

Proposals are scoped per negotiation round. Each party can have one active proposal per parameter per round. Accepted proposals update the `DealRoom.parameters` JSON field in real time.

#### tRPC Procedures for Parameters

| Router | Procedure | Description |
|--------|-----------|-------------|
| `compromise` | `getParameterProposals` | Get all negotiable parameters with pending/active proposals |
| `compromise` | `proposeParameterChange` | Submit a parameter change proposal |
| `compromise` | `respondToParameterProposal` | Accept or reject a pending proposal |

#### Skills with Parameters

| Skill | Parameters |
|-------|-----------|
| Seed Investment | 14 |
| Term Sheet | 15 |
| Employment Agreement | 12 |
| Shareholders Agreement | 12 |
| Consulting Agreement | 10 |
| Joint Venture | 8 |
| Advisory Agreement | 7 |
| Software Development | 7 |
| Equity Incentive Plan | 7 |
| Advertising Insertion Order | 6 |
| IP Assignment | 6 |
| Technology License | 6 |
| Affiliate / Referral Program | 5 |
| Convertible Note | 3 |
| SAFE | 2 |
| MSA | 1 |

Skills without `parameters.json` (NDA, DPA, SaaS, Founders, etc.) skip Step 5 entirely.

#### tRPC Procedure

| Router | Procedure | Description |
|--------|-----------|-------------|
| `deal` | `getParameterSchema` | Returns `ParameterSchema` for a contract type |

### Negotiation

Both parties independently select their preferred option for each clause and set a **firmness** level (1–5) indicating how strongly they feel about their choice. The UI displays firmness while the database stores flexibility (6 − firmness). Selections are **blind** — neither party sees the other's choices until both have submitted.

For contracts with **negotiable parameters** (open fields such as monetary amounts, dates, or geographic scope), parties can propose changes to these values during the review phase. Each proposal includes the proposed value and an optional rationale. The other party can accept or reject each proposal independently.

### Compromise

Once both parties submit, the compromise engine generates suggestions using the weighted stake formula:

```
stake = ((5-flexibility)/5 × 0.6) + (|bias| × 0.4)
```

- **Firmness (60%):** How firmly the party feels about their choice (inverted flexibility)
- **Option bias (40%):** How much the selected option inherently favors one party

The party with the higher stake wins the clause. When stakes are similar, the algorithm selects a balanced middle-ground option. A global fairness pass rebalances if one party wins disproportionately many clauses.

Parties can accept, reject, or counter-propose each suggestion. Multiple rounds are supported.

### Lawyer Involvement

Lawyers can participate at three distinct stages of a deal. Each stage is independent — parties may use any combination (all three, just one, or none).

```
           ┌──────────────────────────────────────────────────────────────────┐
           │                        DEAL TIMELINE                            │
           │                                                                  │
  DRAFT ───┤  Stage 0         NEGOTIATING ──┤ Stage A       AGREED ──┤ Stage B │
           │  Pre-Vetting                   │ Party Counsel          │ Joint   │
           │  Lawyer invites                │ Each party hires       │ Closing │
           │  client to deal                │ own attorney           │ Counsel │
           └──────────────────────────────────────────────────────────────────┘
```

#### Stage 0 — Pre-Vetting (Before Negotiation)

A lawyer with platform access can invite their client to a deal they have pre-configured. The lawyer guides the client through deal creation, sets recommended positions, and monitors the negotiation from the supervisor portal.

| Aspect | Detail |
|--------|--------|
| **When** | Before deal creation |
| **Who initiates** | The lawyer (via client invitation) |
| **Attorney role** | Advisory — recommends positions during negotiation |
| **Platform field** | `DealRoom.lawyerVettingId` |
| **UI** | No additional UI for the client — the lawyer's presence is implicit |

#### Stage A — Party Counsel (After Submission)

After a party submits their selections, they can independently hire an attorney to review their position before compromise begins. Each party chooses their own attorney — the other party is unaware of this review.

| Aspect | Detail |
|--------|--------|
| **When** | After party submits selections (`SUBMITTED`, `REVIEWING`, `ACCEPTED`) |
| **Who initiates** | Each party independently |
| **Attorney role** | Advisory review of that party's position only |
| **Jurisdiction filter** | Only attorneys admitted in the deal's governing law appear |
| **Platform field** | `DealRoomParty.attorneyReviewRequested`, `attorneySupervisorId`, `attorneyReviewApprovedAt` |
| **UI** | `/deals/[id]/review` — attorney selection modal + status banners |

#### Stage B — Joint Closing Counsel (After Agreement)

Once all clauses are agreed, the **initiator** can request a joint closing attorney to help both parties finalize the deal. The other party must acknowledge or decline the request. A joint counsel request blocks signing until resolved.

| Aspect | Detail |
|--------|--------|
| **When** | After all clauses agreed (`AGREED` status) |
| **Who initiates** | Initiator only |
| **Attorney role** | Helps both parties close; neutral position |
| **Jurisdiction filter** | Admitted in deal's governing law; **excludes** any Stage A attorneys for either party |
| **Acknowledgment** | Other party must acknowledge or decline before signing proceeds |
| **Platform fields** | `DealRoom.jointCounselSupervisorId`, `jointCounselRequestedAt`, `jointCounselRequestedBy`, `jointCounselAcknowledgedAt`, `jointCounselDeclinedAt` |
| **UI** | `/deals/[id]/review` — request/acknowledge/decline cards |

#### Signing Gate

Signing is blocked if:
- Either party has a pending (unapproved) Stage A attorney review
- A Stage B joint counsel request is pending (neither acknowledged nor declined)

#### Lawyer Warning Modal

For deals without a pre-vetting lawyer (Stage 0), a one-time modal is shown on the deal detail and negotiate pages. It warns the party about proceeding without legal counsel and summarizes the three stages of lawyer involvement. Dismissed via `DealRoomParty.lawyerWarningDismissedAt`.

| Condition | Modal shown |
|-----------|-------------|
| Deal has `lawyerVettingId` | Never |
| Party already dismissed | Never |
| Deal in `DRAFT`, `AWAITING_RESPONSE`, or `NEGOTIATING` | Yes |
| Deal in `AGREED`, `SIGNING`, `COMPLETED` | No |

#### Adaptive Waiver Text (Stage B)

When joint counsel is requested, each party sees a waiver tailored to whether they used Stage A:

| Party's Stage A status | Waiver text |
|------------------------|-------------|
| Used Stage A (had separate counsel) | "I had separate counsel review my position and consent to joint closing counsel." |
| Skipped Stage A | "I declined separate counsel and consent to joint closing counsel." |

---

## Private Skills Library

Contract skills are maintained in a separate private repository (`legalskills`) and automatically seeded to production via GitHub Actions.

### Available Licensed Skills

| Skill ID | Name | Params | Description |
|----------|------|--------|-------------|
| `com.nel.skills.founders` | Founders Agreement | — | Co-founder equity, vesting, roles, IP, departure terms |
| `com.nel.skills.safe` | SAFE Agreement | 2 | Simple Agreement for Future Equity |
| `com.nel.skills.pacto-socios` | Pacto de Socios | — | Spanish shareholders' pact (native jurisdiction variant) |
| `com.nel.skills.employment` | Employment Agreement | 12 | Employment terms, compensation, non-compete |
| `com.nel.skills.consulting` | Consulting Agreement | 10 | Scope, rates, IP, termination |
| `com.nel.skills.shareholders` | Shareholders Agreement | 12 | Board, transfer restrictions, exit mechanisms |
| `com.nel.skills.convertible-note` | Convertible Note | 3 | Principal, maturity, conversion terms |
| `com.nel.skills.ip-assignment` | IP Assignment | 6 | Scope, moral rights, consideration |
| `com.nel.skills.term-sheet` | Term Sheet | 15 | Round structure, valuation, protective provisions |
| `com.nel.skills.contrato-laboral` | Contrato Laboral | — | Spanish employment contract (native jurisdiction) |
| `com.nel.skills.contrato-servicios` | Contrato de Servicios | — | Spanish service agreement (native jurisdiction) |
| `com.nel.skills.cesion-pi` | Cesión de PI | — | Spanish IP assignment (native jurisdiction) |
| `com.nel.skills.white-label-reseller` | White-Label / Reseller Agreement | — | Distribution, branding, SLA, customisation rights |
| `com.nel.skills.influencer-marketing` | Influencer Marketing Agreement | — | Content deliverables, usage rights, FTC/ASA compliance |
| `com.nel.skills.data-licensing` | Data Licensing Agreement | — | Data sets, usage scope, re-identification prohibitions |
| `com.nel.skills.advertising-io` | Advertising Insertion Order | 6 | Pricing, delivery, viewability, brand safety, fraud protection |
| `com.nel.skills.affiliate-program` | Affiliate / Referral Program Agreement | 5 | Commissions, attribution, clawback, disclosure, exclusivity |

All premium skills are priced at €9/mo. Licensed skills require Platform Admin to assign entitlements to customers before use.

### Skill Categories

| Category | Skills |
|----------|--------|
| **Marketing** | Advertising Insertion Order, Affiliate / Referral Program, Influencer Marketing |
| **Investment** | Convertible Note, SAFE, Term Sheet |
| **Corporate** | Founders Agreement, Shareholders Agreement |
| **Team** | Employment Agreement, Consulting Agreement, Contrato Laboral, Contrato de Servicios |
| **IP** | IP Assignment, Cesión de PI |
| **Data** | Data Licensing |
| **Distribution** | White-Label / Reseller |

Categories are defined in each skill's `metadata.json` and displayed as filter pills in the deal creation UI.

### Repository Structure

```
legalskills/
├── .github/workflows/seed.yml   # Auto-seed on push
├── _template/                   # Template for new skills
├── founders-agreement/
├── safe-agreement/
│   ├── clauses.json             # Clause definitions + options (i18n)
│   ├── manifest.json            # Licensing metadata (skillId, version)
│   ├── parameters.json          # Deal parameters (optional)
│   ├── boilerplate.json         # Preamble, recitals, signature block (optional)
│   ├── clause-mappings.json     # Cross-skill clause mappings (optional)
│   └── SKILL.md
├── ...
└── README.md
```

### Creating a New Skill

1. Copy `_template/` to a new directory (e.g., `employment-agreement/`)
2. Edit `clauses.json` with clauses and options (use `{en, es}` objects for i18n)
3. Add `manifest.json` with licensing metadata (`skillId`, `version`, `jurisdictions`, `languages`)
4. Add `parameters.json` if the contract has deal-specific values (amounts, dates, etc.)
5. Add `boilerplate.json` if the contract needs preamble, recitals, or signature block text
6. Update `SKILL.md` with documentation
7. Push to `main` branch

### Automatic Deployment

When you push changes to skill files (`*/clauses.json`, `*/metadata.json`, `*/manifest.json`), the GitHub Action:

1. Checks out both `legalskills` and `deal-room` repos
2. Runs `npx prisma db seed` against production database
3. Skills are immediately available in the app

### Manual Trigger

```bash
cd /path/to/legalskills
gh workflow run seed.yml
```

### Local Development

```bash
# Set skills directory
export SKILLS_DIR=/path/to/legalskills

# Seed local database
npx prisma db seed

# Build downloadable packages
npm run skill:build
```

### Skill Packaging & Distribution

Premium skills are distributed to self-hosted customers as `.skill` packages (ZIP archives). The packaging pipeline has two steps: **build** and **upload**.

#### Building packages

```bash
# Build all premium skills from the legalskills repo
SKILLS_DIR=/path/to/legalskills npm run skill:build

# Build specific skills only
SKILLS_DIR=/path/to/legalskills npm run skill:build advertising-io affiliate-program

# Custom output directory (default: ./dist)
SKILLS_DIR=/path/to/legalskills npm run skill:build -- --out ./packages
```

This creates `.skill` files in the output directory — one per premium skill.

#### Package contents

Each `.skill` file is a ZIP archive containing:

| File | Required | Description |
|------|----------|-------------|
| `manifest.json` | Yes | Skill ID, version, jurisdictions, languages, file hashes, creation timestamp |
| `content/clauses.json` | Yes | Clause definitions with all options (bilingual) |
| `content/boilerplate.json` | No | Preamble, definitions, standard clauses, jurisdiction provisions |
| `parameters.json` | No | Deal-specific parameter definitions with `boilerplateVariable` mappings |
| `signature.sig` | Yes | Ed25519 signature (empty if `SKILL_SIGNING_PRIVATE_KEY` not set) |

#### Signing packages

To produce signed packages (required for production distribution), set the `SKILL_SIGNING_PRIVATE_KEY` env var:

```bash
SKILL_SIGNING_PRIVATE_KEY="$(cat private-key.pem)" \
  SKILLS_DIR=/path/to/legalskills npm run skill:build
```

Generate a new key pair with:
```bash
npm run keygen
```

The corresponding public key must be set in `SKILL_SIGNING_PUBLIC_KEY` on the target instance for signature verification.

#### Uploading to Vercel Blob

```bash
# Upload all .skill packages from ./dist to Vercel Blob
npm run skill:upload

# Upload from a custom directory
tsx scripts/upload-skill-packages.ts ./packages
```

Required env vars: `BLOB_READ_WRITE_TOKEN`, `DATABASE_URL`.

This uploads each `.skill` file and updates the `SkillPackage.packageUrl` and `packageSize` fields in the database. Customers can then download packages via the `/api/skills/[skillId]/download` endpoint (session auth or time-limited download token).

#### Full deployment workflow

```bash
# 1. Build packages
SKILLS_DIR=/path/to/legalskills npm run skill:build

# 2. Upload to blob storage + update DB
npm run skill:upload

# 3. Customers with active entitlements can now download via:
#    - Billing page (/billing) — "Download" button
#    - Email download links (generated on purchase, 7-day expiry)
#    - Direct API: GET /api/skills/{skillId}/download
```

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | Production Postgres connection string |
| `DEAL_ROOM_TOKEN` | GitHub PAT with repo access to deal-room |

### Refreshing the Token

The `DEAL_ROOM_TOKEN` may expire. To refresh:

1. Create a new PAT at https://github.com/settings/personal-access-tokens
2. Grant `Contents: Read` access to `RINDOGATAN/deal-room`
3. Update the secret in `RINDOGATAN/legalskills` repo settings

### Licensing & Entitlements

Skills with a `manifest.json` file are **licensed** and require entitlements. Skills without manifest are **unlicensed** (free for all users).

**How licensing works:**

1. Skill seeded with `manifest.json` → creates `SkillPackage` + links to `ContractTemplate`
2. Platform Admin assigns entitlement to customer → creates `SkillEntitlement`
3. Customer creates deal → system checks entitlement → access granted or denied

**Assigning entitlements:**

1. Go to `/admin/customers`
2. Select or create customer
3. Assign skill with jurisdictions and license type

**License types:**
- `TRIAL` - Time-limited evaluation
- `SUBSCRIPTION` - Recurring access
- `PERPETUAL` - Permanent access

**Entitlement check response:**

| Scenario | Result |
|----------|--------|
| Licensed skill, no entitlement | `entitled: false` - "No entitlement found" |
| Licensed skill, with entitlement | `entitled: true` - license type returned |
| Unlicensed skill | `entitled: true` - "Free template"

---

## Jurisdiction & Language Constraints

Contract legal text is jurisdiction-native — Spanish law requires Spanish legal terminology to be enforceable. Each contract skill declares which jurisdictions and languages it actually supports, and the platform enforces those constraints at deal creation time.

### How It Works

1. **Skill metadata declares capabilities** — `jurisdictions` and `languages` arrays in `metadata.json` (built-in) or `manifest.json` (licensed)
2. **Seed/sync stores them on `ContractTemplate`** — also preserves full i18n content in `localizedContent` JSON on `ClauseTemplate` and `ClauseOption`
3. **Deal creation UI enforces constraints** — unavailable jurisdictions/languages are greyed out; templates are filtered by the user's platform locale
4. **Server validates on create** — the `deal.create` mutation rejects requests with unsupported jurisdiction or language
5. **Negotiate page resolves i18n** — `deal.getById` resolves `localizedContent` to the deal's `contractLanguage`, so Spanish deals render Spanish labels, descriptions, pros/cons, and legal text

### Metadata Fields

#### `metadata.json` (built-in skills)

```json
{
  "contractType": "DPA",
  "displayName": { "en": "Data Processing Agreement", "es": "Acuerdo de encargo de tratamiento de datos" },
  "description": { "en": "...", "es": "..." },
  "version": "1.0",
  "clauseCount": 12,
  "jurisdictions": ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"],
  "languages": ["en", "es"]
}
```

#### `manifest.json` (licensed skills)

Licensed skills already declare `jurisdictions` and `languages` in their manifest. These are read by the seed and stored on `ContractTemplate`.

### Database Schema

Added to `ContractTemplate`:

| Column | Type | Description |
|--------|------|-------------|
| `jurisdictions` | `String[]` | Supported jurisdictions (e.g., `["CALIFORNIA","ENGLAND_WALES","SPAIN"]`) |
| `languages` | `String[]` | Supported languages (e.g., `["en","es"]`) |
| `displayNameLocalized` | `Json?` | `{"en":"...","es":"..."}` |
| `descriptionLocalized` | `Json?` | `{"en":"...","es":"..."}` |

Added to `ClauseTemplate`:

| Column | Type | Description |
|--------|------|-------------|
| `localizedContent` | `Json?` | `{"title":{"en":"...","es":"..."},"plainDescription":{...},"legalContext":{...}}` |

Added to `ClauseOption`:

| Column | Type | Description |
|--------|------|-------------|
| `localizedContent` | `Json?` | `{"label":{...},"plainDescription":{...},"prosPartyA":{...},"consPartyA":{...},"prosPartyB":{...},"consPartyB":{...},"legalText":{...}}` |

Flat English fields (`title`, `label`, `plainDescription`, etc.) are still populated as before — `localizedContent` is additive and used only for non-English resolution.

### Inference Fallbacks

If `jurisdictions` or `languages` are not explicitly set in metadata/manifest, the seed infers them:

- **Jurisdictions**: scanned from `jurisdictionConfig` keys across all clause options
- **Languages**: detected from the first localized string (e.g., `option.label` with `{en, es}` keys)

### Deal Creation UI Behavior

| Scenario | UI Behavior |
|----------|-------------|
| Template has `languages: ["en","es"]`, user locale is `es` | Template is visible |
| Template has `languages: ["en"]`, user locale is `es` | Template is hidden |
| Template has `jurisdictions: ["CALIFORNIA","SPAIN"]` | England & Wales is greyed out |
| Only one language available for selected jurisdiction | Language auto-selected |
| User selects unsupported combination | Server returns `BAD_REQUEST` |

### i18n Content in `clauses.json`

Clause files use `{en, es}` objects for all translatable fields:

```json
{
  "title": { "en": "Scope of Processing", "es": "Alcance del Tratamiento" },
  "plainDescription": { "en": "...", "es": "..." },
  "options": [{
    "label": { "en": "Narrow", "es": "Restringido" },
    "prosPartyA": { "en": ["..."], "es": ["..."] },
    "legalText": { "en": "...", "es": "..." }
  }]
}
```

Plain strings (without localization) are treated as English and continue to work as before — this is fully backwards-compatible

---

## Signing & Execution Details

### Overview

Once all clauses reach AGREED status, the deal transitions through optional lawyer involvement stages and then into the signing flow at `/deals/[id]/sign`. Before signing, each party must confirm their **execution details** — the legal information that appears in the final contract document.

### Flow

```
AGREED → (optional) Stage A: Party Counsel
       → (optional) Stage B: Joint Closing Counsel
       → /deals/[id]/sign
             │
             ├─ 1. Confirm execution details (both parties)
             ├─ 2. Initiate signing process
             ├─ 3. Type-to-sign (both parties)
             └─ 4. COMPLETED — PDF/DOCX generation
```

> **Note:** Stage A (party counsel) can also be used earlier — from the moment a party submits selections, not just after agreement. See [Lawyer Involvement](#lawyer-involvement) for full details.

### Execution Details Fields

Each party fills in the following on the signing page, **before** they can sign:

| Field | Required | Description |
|-------|----------|-------------|
| **Legal Name** | Yes | Full legal name of the entity (pre-filled from party `company`) |
| **Address** | Yes | Registered address of the entity |
| **Tax ID** | No | Tax identification number (NIF/CIF/EIN) |
| **Signatory Name** | Yes | Full name of the person signing (pre-filled from party `name`) |
| **Signatory Title** | Yes | Title or role of the signatory (e.g., CEO, Managing Director) |

These are stored as JSON in `DealRoomParty.signingDetails`:

```json
{
  "legalName": "Acme Corp, Inc.",
  "address": "123 Main St, San Francisco, CA 94105",
  "taxId": "12-3456789",
  "signatoryName": "Jane Smith",
  "signatoryTitle": "CEO"
}
```

### Detail States

| State | Behavior |
|-------|----------|
| **Not yet confirmed** | Editable form shown; signing is blocked |
| **Confirmed** | Read-only display with "Edit" button; can be modified until signed |
| **Frozen (after signing)** | Read-only, greyed out; cannot be changed |

The other party's confirmed details are visible once submitted, or a "Waiting for other party" placeholder is shown.

### Signing Gate

The type-to-sign section is blocked until the party's own execution details are confirmed. An amber warning is shown:

> "Please confirm your execution details above before signing."

### Reassurance Hint

On the review page (`/deals/[id]/review`), when all clauses are agreed and the "Proceed to Signing" button is shown, an info message appears:

> "You will still have a chance to provide accurate company or signatory details before the contract is executed."

This ensures parties are aware that the name/company provided during deal creation is not final.

### Email Notifications

#### Stage A — Attorney Review Request

When a party requests attorney review via the review page:

1. Party selects a supervisor from the jurisdiction-filtered list
2. A `SupervisorAssignment` is created and the request is logged in the audit trail
3. An email is sent to the supervisor (fire-and-forget via Resend) with:
   - The deal name and requesting party's name
   - A link to the supervisor portal (`/supervise`)
4. The supervisor logs in and reviews the contract terms

#### Stage B — Joint Counsel Request

When the initiator requests joint closing counsel:

1. Initiator selects a supervisor (jurisdiction-filtered, Stage A attorneys excluded)
2. Two emails are sent (fire-and-forget via Resend):
   - **To the supervisor:** assignment notification with deal name and a link to `/supervise`
   - **To the other party:** notification that joint counsel has been requested, with a link to `/deals/[id]/review` to acknowledge or decline

All emails follow the same dark-themed template as invitation emails.

### tRPC Procedures

| Router | Procedure | Description |
|--------|-----------|-------------|
| `signing` | `getSigningDetails` | Get both parties' execution details |
| `signing` | `submitSigningDetails` | Save/update execution details for current party |
| `signing` | `initiate` | Create `SigningRequest`, transition to SIGNING |
| `signing` | `getRequest` | Get signing request status and signatures |
| `signing` | `recordSignature` | Record typed signature for current party |
| `attorneyReview` | `listAvailableAttorneys` | List active supervisors (jurisdiction-filtered, marks conflict-of-interest) |
| `attorneyReview` | `requestReview` | Assign supervisor + send email notification |
| `attorneyReview` | `cancelReview` | Cancel pending (unapproved) review |
| `attorneyReview` | `getReviewStatus` | Review status for both parties |
| `jointCounsel` | `listAvailable` | Supervisors admitted in deal jurisdiction, excluding Stage A attorneys |
| `jointCounsel` | `request` | Initiator requests joint closing counsel |
| `jointCounsel` | `acknowledge` | Other party acknowledges joint counsel request |
| `jointCounsel` | `decline` | Other party declines joint counsel request |
| `jointCounsel` | `getStatus` | Joint counsel state + adaptive waiver text |
| `deal` | `dismissLawyerWarning` | Dismiss the lawyer warning modal for a party |

---

## Skill Catalog

Dealroom ships 44 contract skills: 5 free taster skills, 27 premium skills, and 12 Agent-to-Agent (A2A) skills. All premium and A2A skills are bilingual (EN/ES) and cover 3 jurisdictions.

### Free Taster Skills

Included in the open-source repo (`skills/` directory). English only, basic jurisdiction coverage.

| Skill | Contract Type | Clauses | Params | Description |
|-------|--------------|---------|--------|-------------|
| NDA | NDA | 7 | 0 | Non-disclosure agreement |
| MSA | MSA | 7 | 1 | Master services agreement |
| SaaS Agreement | SAAS | 8 | 0 | SaaS subscription terms |
| DPA | DPA | 8 | 0 | Data processing agreement (GDPR) |
| Privacy Notice | PRIVACY_NOTICE | 6 | 0 | Website/app privacy notice |

### Premium Skills

Require `SkillEntitlement` + active Stripe subscription (€9/mo per skill). All bilingual EN/ES, all support CALIFORNIA, ENGLAND_WALES, and SPAIN jurisdictions.

#### Corporate & Equity

| Skill | Contract Type | Clauses | Params | Party A / Party B |
|-------|--------------|---------|--------|-------------------|
| Founders Agreement | FOUNDERS | 10 | 0 | Lead Founder / Co-Founder |
| Shareholders Agreement | SHAREHOLDERS | 10 | 12 | Majority Shareholder / Minority Shareholder |
| Pacto de Socios | PACTO_SOCIOS | 10 | 0 | Socio Mayoritario / Socio Minoritario |
| Joint Venture Agreement | JOINT_VENTURE | 10 | 8 | Lead Venturer / Co-Venturer |
| Equity Incentive Plan | EQUITY_INCENTIVE | 10 | 7 | Company / Participant |
| Phantom Shares Plan | PHANTOM_SHARES_PLAN | 10 | 0 | Company / Plan Administrator |
| Phantom Shares Grant | PHANTOM_SHARES_GRANT | 10 | 0 | Company / Participant |
| Acta de Junta | ACTA_JUNTA | 10 | 0 | Sociedad / Socios |
| Acta de Consejo | ACTA_CONSEJO | 10 | 0 | Sociedad / Consejeros |

#### Fundraising & Investment

| Skill | Contract Type | Clauses | Params | Party A / Party B |
|-------|--------------|---------|--------|-------------------|
| Seed Investment | SEED_INVESTMENT | 10 | 14 | Company / Investor |
| SAFE Agreement | SAFE | 10 | 2 | Company / Investor |
| Convertible Note | CONVERTIBLE_NOTE | 10 | 3 | Company / Investor |
| Term Sheet | TERM_SHEET | 10 | 15 | Company / Investor |

#### Employment & Services

| Skill | Contract Type | Clauses | Params | Party A / Party B |
|-------|--------------|---------|--------|-------------------|
| Employment Agreement | EMPLOYMENT | 10 | 12 | Employer / Employee |
| Consulting Agreement | CONSULTING | 10 | 10 | Client / Consultant |
| Contrato Laboral | CONTRATO_LABORAL | 10 | 0 | Empleador / Trabajador |
| Contrato de Servicios | CONTRATO_SERVICIOS | 10 | 0 | Cliente / Prestador |
| Advisory Agreement | ADVISORY | 10 | 7 | Company / Advisor |

#### IP & Technology

| Skill | Contract Type | Clauses | Params | Party A / Party B |
|-------|--------------|---------|--------|-------------------|
| IP Assignment | IP_ASSIGNMENT | 10 | 6 | Assignee / Assignor |
| Cesión de PI | CESION_PI | 10 | 0 | Cesionario / Cedente |
| Technology License | TECHNOLOGY_LICENSE | 10 | 6 | Licensor / Licensee |
| Software Development | SOFTWARE_DEVELOPMENT | 10 | 7 | Client / Developer |
| Data Licensing | DATA_LICENSING | 10 | 0 | Data Provider / Data Licensee |

#### Commercial & Marketing

| Skill | Contract Type | Clauses | Params | Party A / Party B |
|-------|--------------|---------|--------|-------------------|
| Advertising IO | ADVERTISING_IO | 10 | 6 | Publisher / Advertiser |
| Affiliate Program | AFFILIATE_PROGRAM | 10 | 5 | Company / Affiliate |
| Influencer Marketing | INFLUENCER_MARKETING | 10 | 0 | Brand / Influencer |
| White Label Reseller | WHITE_LABEL_RESELLER | 10 | 0 | Provider / Reseller |

### New Skills (March 2026)

Five premium skills added on 2026-03-18. Each has 10 negotiable clauses with 3–4 options, bilingual EN/ES legal text, jurisdiction-specific provisions (CA/E&W/ES), and deal parameters with boilerplate variable bindings.

#### Advisory Agreement (`ADVISORY`)

Board or startup advisory agreement covering equity compensation, vesting, time commitment, and scope of advisory services.

**Clauses:**

| # | ID | Title | Options | Category |
|---|-----|-------|---------|----------|
| 1 | `compensation-structure` | Compensation Structure | 4 (Equity Only, Cash Retainer, Hybrid, Success Fee) | Economics |
| 2 | `vesting-schedule` | Vesting Schedule | 3 (Monthly/No Cliff, Quarterly/6mo Cliff, Annual Milestones) | Duration |
| 3 | `time-commitment` | Time Commitment | 3 (Fixed Hours, As Needed, Structured Cadence) | Operations |
| 4 | `advisory-scope` | Advisory Scope | 4 (Strategic Only, Operational, Full Board Seat, Limited Intro) | Scope |
| 5 | `ip-work-product` | IP and Work Product | 3 (Company Owns All, Advisor Retains/Licenses, Shared) | IP |
| 6 | `confidentiality` | Confidentiality | 3 (Comprehensive Mutual, Company One-Way, Limited Duration) | Protection |
| 7 | `term-and-renewal` | Term and Renewal | 3 (Fixed 12mo, Auto-Renew, Evergreen) | Duration |
| 8 | `non-compete` | Non-Compete | 3 (Broad, Narrow/Direct Competitors, None) | Restrictions |
| 9 | `termination-rights` | Termination Rights | 3 (At Will 30 Days, Cause Only, Mutual with Vesting Acceleration) | Duration |
| 10 | `equity-acceleration` | Equity Acceleration | 4 (Full on CoC, Double Trigger, Pro-Rata Partial, None) | Events |

**Parameters:** `advisor-name` (text, req), `advisor-title` (text), `equity-percentage` (%), `monthly-hours` (num, default 5), `retainer-amount` (currency), `vesting-months` (num, default 24), `start-date` (date)

**Jurisdiction highlights:**
- **California:** Cal. Corp. Code § 25102(o) exemption for compensatory equity, IRC § 83(b) election, Cal. Bus. & Prof. Code §§ 16600–16607 non-compete limits
- **England & Wales:** EMI scheme eligibility (ITEPA 2003), Companies Act 2006 §§ 551/561 for share allotment, 12-month non-compete maximum per restraint of trade doctrine
- **Spain:** Ley 28/2022 startup equity exemption (€50,000), LSC arts. 107–112 share transfer restrictions, Estatuto de los Trabajadores art. 21 non-compete rules

---

#### Technology License Agreement (`TECHNOLOGY_LICENSE`)

Technology licensing agreement for software, patents, or proprietary systems covering license scope, royalties, sublicensing, and audit rights.

**Clauses:**

| # | ID | Title | Options | Category |
|---|-----|-------|---------|----------|
| 1 | `license-scope` | License Scope | 4 (Exclusive, Non-Exclusive, Sole, Field-of-Use) | Scope |
| 2 | `fee-structure` | Fee Structure | 4 (Lump Sum, Running Royalty, Hybrid, Minimum Guarantee) | Economics |
| 3 | `sublicensing-rights` | Sublicensing Rights | 3 (None, With Consent, Unrestricted) | Rights |
| 4 | `source-code-escrow` | Source Code Access | 3 (No Access, Escrow, Full Source) | IP |
| 5 | `warranty-and-support` | Warranty and Support | 3 (As-Is, Limited, Comprehensive) | Operations |
| 6 | `ip-improvements` | Ownership of Improvements | 3 (Licensor Owns, Licensee Owns, Joint) | IP |
| 7 | `term-and-renewal` | Term and Renewal | 3 (Fixed, Auto-Renew, Perpetual) | Duration |
| 8 | `termination-rights` | Termination Rights | 3 (Cause Only, Convenience, Breach+Cure) | Duration |
| 9 | `liability-cap` | Liability Cap | 3 (Mutual Cap, Unlimited IP, Tiered) | Risk |
| 10 | `audit-rights` | Audit Rights | 3 (None, Annual, On Suspicion) | Compliance |

**Parameters:** `technology-description` (text, req), `license-fee` (currency), `royalty-rate` (%), `territory` (text, default "Worldwide"), `term-years` (num, default 3), `minimum-guarantee` (currency)

**Jurisdiction highlights:**
- **California:** Cal. Civ. Code § 1647 (place of contracting), Cal. UCC for implied warranties, antitrust review under Cartwright Act
- **England & Wales:** Patents Act 1977, CDPA 1988 for copyright licensing, CMA/Competition Act 1998 for technology transfer block exemptions
- **Spain:** LPI (RDL 1/1996) arts. 48–50 for software licensing, Ley de Patentes 24/2015, CNMC competition review for exclusive licenses

---

#### Joint Venture Agreement (`JOINT_VENTURE`)

Joint venture agreement for collaborative business ventures covering structure, capital contributions, governance, profit sharing, and exit mechanisms.

**Clauses:**

| # | ID | Title | Options | Category |
|---|-----|-------|---------|----------|
| 1 | `jv-structure` | JV Structure | 3 (Contractual, New LLC/Entity, Partnership) | Structure |
| 2 | `capital-contributions` | Capital Contributions | 3 (Equal Cash, Proportional, In-Kind) | Economics |
| 3 | `management-governance` | Management and Governance | 3 (Equal Voting, Majority Control, Independent Board) | Governance |
| 4 | `profit-loss-sharing` | Profit and Loss Sharing | 3 (Pro Rata, Performance-Based, Preferred Return) | Economics |
| 5 | `decision-making` | Major Decision Thresholds | 3 (Unanimous, Supermajority, Deadlock Mechanism) | Governance |
| 6 | `ip-contributions` | IP Contributions | 3 (License-In, Assign to JV, License with Reversion) | IP |
| 7 | `non-compete` | Non-Compete | 3 (Full, Field-Limited, None) | Restrictions |
| 8 | `exit-mechanisms` | Exit Mechanisms | 3 (Buy-Sell Shotgun, Put-Call, ROFR) | Duration |
| 9 | `term-and-dissolution` | Term and Dissolution | 3 (Fixed, Indefinite, Project-Based) | Duration |
| 10 | `dispute-resolution` | Dispute Resolution | 3 (Binding Arbitration, Mediation+Arbitration, Court) | Risk |

**Parameters:** `jv-name` (text, req), `jv-purpose` (text, req), `party-a-contribution` (currency), `party-b-contribution` (currency), `ownership-split` (text, default "50/50"), `term-years` (num, default 5), `territory` (text)

**Jurisdiction highlights:**
- **California:** Cal. Corp. Code §§ 16100–16962 (RUPA) for partnerships, LLC formation under Cal. Corp. Code § 17701, FAA for arbitration clauses
- **England & Wales:** Partnership Act 1890, LLP Act 2000, Competition Act 1998 for JV antitrust analysis, Arbitration Act 1996
- **Spain:** Código Civil arts. 1665–1708 (sociedad civil), LSC for corporate JV vehicles, arts. 225–232 fiduciary duties, Ley 60/2003 de Arbitraje

---

#### Software Development Agreement (`SOFTWARE_DEVELOPMENT`)

Custom software development agreement covering methodology, IP ownership, acceptance testing, payment structure, and source code delivery.

**Clauses:**

| # | ID | Title | Options | Category |
|---|-----|-------|---------|----------|
| 1 | `development-methodology` | Development Methodology | 4 (Agile, Waterfall, Hybrid, Time & Materials) | Process |
| 2 | `ip-ownership` | IP Ownership | 3 (Client Owns All, Developer Retains+Licenses, Joint) | IP |
| 3 | `payment-structure` | Payment Structure | 3 (Fixed Price, Time & Materials, Milestone-Based) | Economics |
| 4 | `acceptance-testing` | Acceptance Testing | 3 (Formal UAT, Deemed Acceptance, Continuous) | Quality |
| 5 | `warranty-period` | Warranty Period | 3 (90 Days, 6 Months, 12 Months) | Quality |
| 6 | `source-code-delivery` | Source Code Delivery | 3 (Full Repo, Compiled Only, Escrow) | Delivery |
| 7 | `change-management` | Change Management | 3 (Strict Change Order, Flexible Budget, Impact Assessment) | Process |
| 8 | `confidentiality` | Confidentiality | 3 (Mutual NDA, One-Way, Mutual+Portfolio Carve-Out) | Protection |
| 9 | `liability-and-indemnity` | Liability and Indemnity | 3 (Cap at Fees, Unlimited IP, Mutual Proportional) | Risk |
| 10 | `termination-and-handover` | Termination and Handover | 3 (For Convenience, Cause Only, Milestone Gate) | Duration |

**Parameters:** `project-name` (text, req), `project-description` (text, req), `total-budget` (currency), `daily-rate` (currency), `warranty-months` (num, default 6), `delivery-date` (date), `tech-stack` (text)

**Jurisdiction highlights:**
- **California:** Cal. Lab. Code §§ 2750.5–2784 for independent contractor classification (ABC test), Cal. Civ. Code § 2860 for IP work-for-hire, Cal. UCC § 2316 warranty disclaimers
- **England & Wales:** CDPA 1988 § 11 (employer IP ownership), Supply of Goods and Services Act 1982, IR35 (off-payroll working rules) for contractor status
- **Spain:** LPI art. 97 (employer owns employee software by default), art. 43 (license interpretation stricto sensu), LOPDGDD for data handling, Estatuto de los Trabajadores for contractor reclassification risk

---

#### Equity Incentive Plan (`EQUITY_INCENTIVE`)

Equity incentive plan for startups and growth companies covering plan type (ISO/NSO/RSU/SAR), vesting, exercise pricing, and change of control provisions.

**Clauses:**

| # | ID | Title | Options | Category |
|---|-----|-------|---------|----------|
| 1 | `plan-type` | Plan Type | 4 (ISO, NSO, RSU, SAR) | Structure |
| 2 | `share-pool-size` | Share Pool Size | 3 (Fixed Number, % of Diluted, Evergreen) | Economics |
| 3 | `exercise-price` | Exercise Price | 3 (FMV/409A, Discount, Nominal) | Economics |
| 4 | `vesting-schedule` | Vesting Schedule | 3 (4yr+1yr Cliff, 3yr Monthly, Milestone-Based) | Duration |
| 5 | `acceleration-events` | Acceleration Events | 3 (Single Trigger, Double Trigger, None) | Events |
| 6 | `exercise-window` | Post-Termination Exercise Window | 3 (90 Days, 1 Year, Extended Tenure) | Rights |
| 7 | `transferability` | Transferability | 3 (Non-Transferable, Limited Family, Company ROFR) | Restrictions |
| 8 | `clawback-provisions` | Clawback Provisions | 3 (None, Cause Termination, Good-Bad Leaver) | Protection |
| 9 | `change-of-control` | Change of Control Treatment | 3 (Full Acceleration, Assumed by Acquirer, Board Discretion) | Events |
| 10 | `plan-administration` | Plan Administration | 3 (Board, Compensation Committee, Delegated to CEO) | Governance |

**Parameters:** `plan-name` (text, req), `total-shares` (num), `pool-percentage` (%, default 10), `exercise-price` (currency), `vesting-months` (num, default 48), `cliff-months` (num, default 12), `post-termination-days` (num, default 90)

**Jurisdiction highlights:**
- **California:** IRC § 422 ISOs ($100k annual vesting limit, 110% FMV for 10% shareholders), IRC § 409A valuation requirements, Cal. Corp. Code § 25102(o) securities exemption, IRC § 83(b) election
- **England & Wales:** EMI scheme (ITEPA 2003) for tax-advantaged options, Companies Act 2006 §§ 551/561 allotment authority, HMRC 92-day notification, NIC joint election
- **Spain:** Ley 28/2022 startup exemption (€50,000/year), LSC arts. 107–112 share transfer restrictions, art. 304 pre-emption rights disapplication, IRPF art. 17.2 in-kind employment income

---

### Agent-to-Agent (A2A) Skills

12 skills for autonomous agent interactions. Bundled under the A2A subscription (€9/mo standard, €60/mo premium). All bilingual EN/ES, 3 jurisdictions. Every skill includes Gavel automated arbitration as the default dispute resolution option.

| Skill | Contract Type | Clauses | Party A / Party B |
|-------|--------------|---------|-------------------|
| API Access Agreement | A2A_API_ACCESS | 8 | Provider / Consumer |
| Tool License Agreement | A2A_TOOL_LICENSE | 7 | Provider / Licensee |
| Data Sharing Agreement | A2A_DATA_SHARING | 8 | Data Provider / Data Recipient |
| Compute Procurement Agreement | A2A_COMPUTE_PROCUREMENT | 7 | Provider / Consumer |
| Task Delegation Agreement | A2A_TASK_DELEGATION | 7 | Principal / Subcontractor |
| Content License Agreement | A2A_CONTENT_LICENSE | 7 | Licensor / Licensee |
| Marketplace Terms Agreement | A2A_MARKETPLACE | 7 | Operator / Participant |
| Orchestration Agreement | A2A_ORCHESTRATION | 7 | Orchestrator / Participant |
| Payment Authorization Agreement | A2A_PAYMENT_AUTHORIZATION | 7 | Payment Provider / Payer |
| Knowledge Access Agreement | A2A_KNOWLEDGE_ACCESS | 7 | Knowledge Provider / Consumer |
| Supply Chain Collaboration Agreement | A2A_SUPPLY_CHAIN | 7 | Coordinator / Partner |
| Agent Monitoring Agreement | A2A_MONITORING | 7 | Principal / Monitor |

See [a2a-contracts.md](./a2a-contracts.md) for full documentation including negotiation examples and technical implementation.

---

## Scenario Testing & Demo Content

### Deal Simulator

`scripts/simulate-deals.ts` smoke-tests the full deal lifecycle for every built-in contract skill and produces completed demo deals visible in the `/deals` dashboard.

```bash
npm run deal:simulate            # create demo deals (idempotent)
npm run deal:simulate -- --clean # delete and recreate from scratch
```

**Prerequisites:** Templates must be seeded first (`npx prisma db seed`).

#### What it does

For each deal variant the script runs the full 10-step lifecycle:

1. Create DealRoom (DRAFT) with initiator party and clauses
2. Party A makes selections (bias-driven strategy)
3. Submit Party A (SUBMITTED)
4. Create respondent party + accepted invitation (AWAITING_RESPONSE)
5. Party B makes selections (bias-driven strategy)
6. Submit Party B (NEGOTIATING)
7. Run compromise engine (`calculateCompromise` + `globalFairnessPass`)
8. Create CompromiseSuggestion records (both parties accept)
9. Finalize (AGREED)
10. Sign via type-to-sign (COMPLETED)

#### Deal variants

| Template | Jurisdiction | Lang | Boilerplate |
|----------|-------------|------|-------------|
| DPA | CALIFORNIA | en | Yes |
| DPA | SPAIN | es | Yes |
| NDA | CALIFORNIA | en | Yes |
| MSA | CALIFORNIA | en | Yes |
| SAAS | CALIFORNIA | en | Yes |
| SEED_INVESTMENT | CALIFORNIA | en | Yes |
| SEED_INVESTMENT | SPAIN | es | Yes |
| ADVERTISING_IO | CALIFORNIA | en | Yes |
| ADVERTISING_IO | SPAIN | es | Yes |
| AFFILIATE_PROGRAM | CALIFORNIA | en | Yes |
| AFFILIATE_PROGRAM | SPAIN | es | Yes |

Templates that support Spanish + SPAIN jurisdiction get an additional Spanish-language variant.

#### Demo accounts

| User | Email | Company |
|------|-------|---------|
| Alice Johnson | `alice@demo.todo.law` | Acme Corp |
| Bob Smith | `bob@demo.todo.law` | Widget Inc |

Users are created via `upsert` so the script is safe to re-run.

#### Selection strategy

Selections are deterministic and designed to produce ~50% agreement / ~50% divergence:

- **Party A:** sorts options by `biasPartyA` descending. Even-ordered clauses pick index 0 (most A-favorable), odd-ordered clauses pick index 1.
- **Party B:** same logic using `biasPartyB`.
- **Priority:** 5 if |bias| > 0.3, 4 if > 0.1, else 3.
- **Flexibility:** 1 if |bias| > 0.3, 2 if > 0.1, else 3.

#### Contract validation

After each deal completes, the script runs 14 inline checks:

1. Contract data is non-null
2. Party A name present and not a placeholder
3. Party B name present and not a placeholder
4. Party A company present
5. Party B company present
6. All clauses have legal text >20 chars
7. All clauses have non-empty titles
8. Clause count matches template
9. Boilerplate present (templates with boilerplate)
10. Preamble non-empty (when boilerplate exists)
11. No unresolved `{variable}` placeholders
12. Governing law display string non-empty
13. Language matches expected value
14. Date is valid

#### Idempotency

- Without `--clean`: skips deals that already exist (matched by name)
- With `--clean`: deletes all `"Demo: *"` deals first, then recreates
- Demo users always use `upsert`

#### Implementation notes

The script uses direct `PrismaClient` instantiation (like `seed.ts`) and imports the compromise engine functions via relative paths. Contract validation logic is inlined from `generator.ts` to avoid `@/lib/prisma` path alias issues in the scripts directory.
