# Deployment — Multi-Brand Architecture

Dealroom is a single codebase that serves multiple brands. Each brand is a separate Vercel project pointing to the same GitHub repository, differentiated only by environment variables.

---

## Brands

| Brand | `NEXT_PUBLIC_BRAND` | Domain | Auth Mode | UI Style |
|-------|---------------------|--------|-----------|----------|
| **TODO.LAW** | `todo` (default) | `dealroom.todo.law` | Magic-link + Google | Rounded blue (`#53aecc`) |
| **North End Law** | `northend` | `dealroom.northend.law` | Invite-code + Google | Brutalist teal (`#13e9d1`) |

Setting `NEXT_PUBLIC_BRAND` controls:
- Visual theme (colors, border radii, shadows, fonts)
- Auth flow (magic-link vs invite-code)
- Feature availability (lawyer involvement, marketplace, billing, agent API, public docs)
- Email template branding (colors, domain, company name)
- Cookie domain for cross-subdomain auth
- Header logo and footer content

---

## Architecture

```
GitHub Repo (RINDOGATAN/deal-room)
├── Vercel Project A (todo.law)
│   └── NEXT_PUBLIC_BRAND=todo
│       DATABASE_URL=postgres://...todo...
│       NEXTAUTH_URL=https://dealroom.todo.law
│       ...
│
└── Vercel Project B (northend.law)
    └── NEXT_PUBLIC_BRAND=northend
        DATABASE_URL=postgres://...northend...
        NEXTAUTH_URL=https://dealroom.northend.law
        ...
```

Both projects deploy from `main`. Each has its own:
- PostgreSQL database
- Resend email sender identity
- Google OAuth credentials
- Stripe account (optional, todo.law only)
- Custom domain

---

## How It Works

### 1. Brand Config (`src/config/brand.ts`)

A router that imports from `src/config/brands/todo.ts` or `src/config/brands/northend.ts` based on `NEXT_PUBLIC_BRAND`. The brand config defines:

- Company name, domain, contact email
- Color palette (primary, background, card, foreground, muted, border)
- Theme overrides (border radii, shadows — null for brutalist)
- Auth mode (`magic-link` or `invite-code`)
- Asset paths (logo, favicon)
- External links (terms, privacy, website)
- Cookie domain
- Footer content (null for todo.law, populated for northend.law)

### 2. Feature Flags (`src/config/features.ts`)

Feature flags derived from brand config and environment variables:

| Flag | `todo` | `northend` | Source |
|------|--------|------------|--------|
| `magicLinkAuth` | true | false | `brand.auth.mode` |
| `inviteCodeAuth` | false | true | `brand.auth.mode` |
| `lawyerInvolvement` | true | false | `brand.id` |
| `marketplace` | true | false | `brand.id` |
| `clientInvitations` | true | false | `brand.id` |
| `agentApi` | true | false | `brand.id` |
| `publicDocs` | true | false | `brand.id` |
| `billing` | if Stripe key | if Stripe key | `STRIPE_SECRET_KEY` |
| `stripeEnabled` | if Stripe key | if Stripe key | `STRIPE_SECRET_KEY` |

### 3. CSS Theming (`src/app/globals.css`)

The root layout sets `<html data-brand="todo|northend">`. CSS uses:

- `:root` — todo.law defaults (all CSS variables)
- `[data-brand="northend"]` — overrides variables + component classes:
  - All `--radius-*: 0` (brutalist corners)
  - All `--shadow-*: none` (no shadows)
  - Primary color `#13e9d1` (teal)
  - Dark blue background `#1c1f37`
  - Amber destructive (`#f59e0b` instead of red)
  - No noise texture (`body::before { display: none }`)
  - Headings use body font (no Archivo Black)
  - Buttons use border instead of shadow, hover inverts colors

### 4. Auth Providers (`src/lib/auth.ts`)

Auth providers are conditionally included based on feature flags:

- **todo.law**: Google + EmailProvider (magic link)
- **northend.law**: Google + CredentialsProvider (invite code)
- Both: E2E credentials provider (when `E2E_CREDENTIALS_SECRET` is set)

Cookie domain uses `brand.cookieDomain` instead of hardcoded `.todo.law`.

### 5. Route-Level Feature Gates

Routes return `notFound()` when their feature is disabled:

| Route | Feature Flag | Gate |
|-------|-------------|------|
| `/lawyer/*` | `lawyerInvolvement` | `src/app/(dashboard)/lawyer/layout.tsx` |
| `/billing/*` | `billing` | `src/app/(dashboard)/billing/layout.tsx` |
| `/marketplace/*` | `marketplace` | `src/app/(dashboard)/marketplace/layout.tsx` |
| `/client-invite/*` | `clientInvitations` | `src/app/client-invite/layout.tsx` |
| `/docs/*` | `publicDocs` | `src/app/(public)/docs/layout.tsx` |
| `/api/v1/*` | `agentApi` | Each route handler returns 404 |

Dashboard navigation and footer links are also conditionally rendered.

### 6. Email Templates (`src/lib/email.ts`)

All email templates use a shared `emailWrapper()` function that injects brand colors, domain, and company name dynamically. No hardcoded hex values or domain strings.

---

## Environment Variables

### Required (both brands)

```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<random-secret>
NEXTAUTH_URL=https://dealroom.<domain>
NEXT_PUBLIC_BRAND=todo|northend
RESEND_API_KEY=<resend-key>
EMAIL_FROM=noreply@<domain>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
```

### Optional

```
SKILLS_DIR=/path/to/legalskills          # Premium skills directory
STRIPE_SECRET_KEY=<stripe-key>           # Enables billing/marketplace
STRIPE_WEBHOOK_SECRET=<stripe-webhook>   # Stripe webhook verification
STRIPE_PRICE_ID=<price-id>              # Shared add-on price
E2E_CREDENTIALS_SECRET=<secret>          # E2E test auth bypass
```

---

## Setting Up a New Brand Deployment

### 1. Create Vercel Project

1. Go to Vercel → New Project
2. Connect to `RINDOGATAN/deal-room` repository
3. Set environment variables (see above)
4. Set `NEXT_PUBLIC_BRAND=northend`
5. Configure custom domain (`dealroom.northend.law`)

### 2. Database

1. Create a new PostgreSQL database
2. Set `DATABASE_URL` in Vercel env vars
3. Run `npx prisma migrate deploy` to apply schema
4. Run `NEXT_PUBLIC_BRAND=northend npx prisma db seed` to seed data

### 3. Google OAuth

1. Create OAuth credentials in Google Cloud Console
2. Add authorized redirect URI: `https://dealroom.northend.law/api/auth/callback/google`
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

### 4. Email (Resend)

1. Verify sender domain in Resend
2. Set `RESEND_API_KEY` and `EMAIL_FROM`

### 5. Invite Codes (northend.law only)

1. Create a platform admin: `npm run admin:create -- --email=admin@northend.law`
2. Log in at `/admin`
3. Create customers at `/admin/customers`
4. Generate invite codes for each customer (Admin → Customer → Invite Codes)

---

## Shared vs Separate

| Resource | Shared | Separate |
|----------|--------|----------|
| GitHub repo | Yes | — |
| Codebase | Yes | — |
| Prisma schema | Yes | — |
| Skills directory | Yes | — |
| Vercel project | — | Yes |
| PostgreSQL database | — | Yes |
| Google OAuth credentials | — | Yes |
| Resend sender domain | — | Yes |
| Stripe account | — | Yes (optional) |
| Custom domain | — | Yes |

---

## Adding a New Brand

1. Create `src/config/brands/<brand>.ts` implementing `BrandConfig`
2. Add the brand id to the union type in `src/config/brand.ts`
3. Add a case to the router in `src/config/brand.ts`
4. Update `src/config/features.ts` if the new brand has different feature gates
5. Add `[data-brand="<brand>"]` CSS overrides in `globals.css`
6. Add brand logo to `/public/`
7. Deploy as a new Vercel project with `NEXT_PUBLIC_BRAND=<brand>`
