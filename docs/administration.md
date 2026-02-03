# Administration System

This document explains Deal Room's two-level administration system for managing the platform and supervising negotiations.

---

## Overview

Deal Room uses a separation of concerns for administration:

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

Supervisors receive no notification - they simply see the deal when they next log in.

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

  twoFactorSecret SupervisorTwoFactor?
  assignments     SupervisorAssignment[]
}

model SupervisorTwoFactor {
  id           String   @id @default(cuid())
  supervisorId String   @unique
  secret       String
  verified     Boolean  @default(false)
  createdAt    DateTime @default(now())

  supervisor Supervisor @relation(...)
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
| `listSupervisors` | All supervisors with assignment counts |
| `createSupervisor` | Create new supervisor account |
| `toggleSupervisorActive` | Activate/deactivate supervisor |
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
| `getDealDetails` | Full deal view (if assigned) |
| `getDashboardStats` | Stats for assigned deals |

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

## Private Skills Library

Contract skills are maintained in a separate private repository (`legalskills`) and automatically seeded to production via GitHub Actions.

### Available Licensed Skills

| Skill ID | Name | Clauses | Description |
|----------|------|---------|-------------|
| `com.nel.skills.founders` | Founders Agreement | 10 | Co-founder equity, vesting, roles, IP, departure terms |
| `com.nel.skills.safe` | SAFE Agreement | 10 | Simple Agreement for Future Equity for startup fundraising |

Licensed skills require Platform Admin to assign entitlements to customers before use.

### Repository Structure

```
legalskills/
├── .github/workflows/seed.yml   # Auto-seed on push
├── _template/                   # Template for new skills
├── founders-agreement/          # Founders Agreement skill
├── safe-agreement/              # SAFE Agreement skill
│   ├── metadata.json
│   ├── clauses.json
│   ├── manifest.json
│   └── SKILL.md
└── README.md
```

### Creating a New Skill

1. Copy `_template/` to a new directory (e.g., `employment-agreement/`)
2. Edit `metadata.json` with skill info
3. Edit `clauses.json` with clauses and options
4. Update `SKILL.md` with documentation
5. Push to `main` branch

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
```

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | Production Postgres connection string |
| `DEAL_ROOM_TOKEN` | GitHub PAT with repo access to deal-room |

### Refreshing the Token

The `DEAL_ROOM_TOKEN` may expire. To refresh:

1. Create a new PAT at https://github.com/settings/personal-access-tokens
2. Grant `Contents: Read` access to `sergiomaldo/deal-room`
3. Update the secret in legalskills repo settings

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
