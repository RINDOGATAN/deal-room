# LexBooks Integration Guide

How to integrate LexBooks with Dealroom and the todo.law ecosystem.

**LexBooks role:** Unified dashboard where lawyers and experts manage their work across all todo.law apps — revenue from published skills (Clausemaster), contract projects (Dealroom), ad hoc requests (DPO Central, AI Sentinel, VendorWatch), payments, accounting, and tasks.

**Dealroom role:** Hosts the Experts Directory, the contract negotiation engine, and the REST API that all todo.law apps consume.

---

## 1. Architecture Overview

```
                          ┌─────────────┐
                          │  LexBooks   │
                          │  (Unified   │
                          │   Inbox)    │
                          └──────┬──────┘
                                 │ polls/reads
                                 ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐
│DPO       │  │AI        │  │Vendor    │  │Clausemaster│
│Central   │  │Sentinel  │  │Watch     │  │(Skills)    │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘
     │             │             │               │
     └─────────────┴──────┬──────┴───────────────┘
                          │ API calls
                          ▼
                   ┌─────────────┐
                   │  Dealroom   │
                   │  REST API   │
                   │  /api/v1/*  │
                   └─────────────┘
```

Every external app authenticates to Dealroom with an API key (`drk_...`) issued per Customer in the admin panel at `/admin/customers/[id]`. LexBooks is both a consumer (polling request status, fetching deal outcomes) and a provider (showing experts their unified inbox).

---

## 2. Authentication

All API calls use Bearer token authentication:

```
Authorization: Bearer drk_<64 hex characters>
```

Keys are SHA-256 hashed and stored in the `ApiKey` table. Each key has scopes that control access.

**Available scopes:**

| Scope | Grants access to |
|-------|-----------------|
| `experts:read` | Search experts, fetch profiles |
| `experts:contact` | Send contact requests, poll request status |
| `deals:read` | List and fetch deal outcomes, download PDFs |
| `deals:write` | (reserved) |
| `templates:read` | List contract templates and clauses |
| `playbook:read` | List negotiation playbooks |
| `playbook:write` | Create/update playbooks |
| `negotiate` | Initiate automated negotiations |

**LexBooks needs:** `experts:read` + `experts:contact` + `deals:read` at minimum. If LexBooks will initiate negotiations on behalf of experts, add `negotiate`.

**Key management:** Admin creates keys at `/admin/customers/[id]`. The raw key is shown once on creation — store it securely. Keys can be revoked (soft-disable) or deleted (hard) from the admin panel.

---

## 3. Experts Directory

**Base URL:** `https://dealroom.todo.law/api/v1/experts`

### 3.1 Search experts

```
POST /api/v1/experts/search
Scope: experts:read

Body:
{
  "query": "privacy",                    // Free-text (name, company, bio)
  "specialization": "GDPR",             // Taxonomy code
  "country": "ES",                      // ISO 3166-1 alpha-2
  "language": "es",                     // ISO 639-1
  "expertType": "TECHNICAL",          // TECHNICAL | DEPLOYMENT
  "limit": 20,                          // 1-100
  "offset": 0
}

Response:
{
  "results": [{
    "id": "clxyz...",
    "name": "Alex Ferris",
    "email": "alex@example-firm.test",
    "title": "Founder & DPO",
    "firm": "todo.law",
    "bio": "...",
    "expertTypes": ["legal", "technical"],
    "specializations": ["GDPR", "AI Governance / EU AI Act"],
    "certifications": ["CIPP/E", "CIPM"],
    "languages": ["en", "es"],
    "location": { "city": "Barcelona", "country": "ES" },
    "jurisdictions": ["EU", "UK", "US"],
    "contactUrl": "mailto:alex@example-firm.test",
    "imageUrl": "https://...",
    "acceptingClients": true,
    "profileCompleteness": 85
  }],
  "total": 12,
  "offset": 0
}
```

Results are sorted by `profileCompleteness` descending. Specializations and certifications are returned as human-readable labels (not codes).

### 3.2 Get single expert

```
GET /api/v1/experts/:userId
Scope: experts:read

Response: same shape as a single search result item
Returns 404 if profile not published.
```

### 3.3 Expert taxonomy (hardcode in LexBooks)

**Expert types:** `TECHNICAL`, `DEPLOYMENT` (non-exclusive, stored as array; `LEGAL` retired 2026-07 — legacy rows are never returned by the API)

**Specializations (17):**

| Code | Label |
|------|-------|
| `GDPR` | GDPR |
| `CCPA_US_STATE_PRIVACY` | CCPA / US State Privacy |
| `DPIA_IMPACT_ASSESSMENTS` | DPIA / Impact Assessments |
| `DSAR_DATA_SUBJECT_RIGHTS` | DSAR / Data Subject Rights |
| `CROSS_BORDER_TRANSFERS` | Cross-Border Transfers |
| `DPA_VENDOR_CONTRACTS` | DPA / Vendor Contracts |
| `VENDOR_RISK_MANAGEMENT` | Vendor Risk Management |
| `INCIDENT_RESPONSE_BREACH_NOTIFICATION` | Incident Response / Breach Notification |
| `PRIVACY_BY_DESIGN` | Privacy by Design |
| `AI_GOVERNANCE_EU_AI_ACT` | AI Governance / EU AI Act |
| `EPRIVACY_COOKIE_COMPLIANCE` | ePrivacy / Cookie Compliance |
| `HEALTHCARE_HIPAA` | Healthcare / HIPAA |
| `FINANCIAL_SERVICES_PSD2` | Financial Services / PSD2 |
| `CHILDRENS_PRIVACY_AADC` | Children's Privacy / AADC |
| `ISO_27001_SOC2_AUDITING` | ISO 27001 / SOC 2 Auditing |
| `COMPLIANCE_FRAMEWORKS_ROPA` | Compliance Frameworks / ROPA |
| `SELF_HOSTING_DEPLOYMENT` | Self-Hosting / Deployment |

**Certifications (10):**

| Code | Label |
|------|-------|
| `CIPP_E` | CIPP/E |
| `CIPP_US` | CIPP/US |
| `CIPM` | CIPM |
| `CIPT` | CIPT |
| `CISSP` | CISSP |
| `CISM` | CISM |
| `ISO_27701_LEAD_AUDITOR` | ISO 27701 Lead Auditor |
| `ISO_27001_LEAD_AUDITOR` | ISO 27001 Lead Auditor |
| `CDPSE` | CDPSE |
| `FIP` | FIP |

These are validated at the application layer, not as database enums. New values can be added without migrations.

---

## 4. Contact Requests (The Core Integration)

This is the primary integration point. Any todo.law app can send a contact request to an expert, and LexBooks aggregates them into a unified inbox.

### 4.1 Send a contact request

```
POST /api/v1/experts/:userId/contact
Scope: experts:contact

Body:
{
  "requesterName": "Jane Doe",                 // required
  "requesterEmail": "jane@acme.com",           // required, validated
  "requesterCompany": "Acme Inc",              // optional
  "subject": "DPO Assessment for GDPR Audit",  // required (shown as heading)
  "message": "We need help with...",           // optional
  "governingLaw": "SPAIN"                      // optional: CALIFORNIA | ENGLAND_WALES | SPAIN
}

Response (201):
{
  "requestId": "clxyz...",
  "status": "PENDING",
  "createdAt": "2026-03-11T14:30:00.000Z"
}
```

**What happens on the Dealroom side:**
1. A `RecommendationRequest` record is created with `sourceApp` = the Customer name (e.g. "DPO Central") and `sourceCustomerId` = the API key's customer ID
2. The expert receives an email notification with the requester info and a "View Request" CTA linking to `/lawyers/requests`
3. The request appears in the expert's inbox at `/lawyers/requests` with a badge showing the source app name
4. Duplicate detection: returns 409 if a PENDING request already exists from the same email + subject

### 4.2 Poll request status

```
GET /api/v1/experts/requests/:requestId
Scope: experts:contact

Response:
{
  "requestId": "clxyz...",
  "expertId": "cluser...",
  "expertName": "Alex Ferris",
  "subject": "DPO Assessment for GDPR Audit",
  "status": "PENDING",
  "message": "We need help with...",
  "requesterName": "Jane Doe",
  "requesterEmail": "jane@acme.com",
  "requesterCompany": "Acme Inc",
  "governingLaw": null,
  "respondedAt": null,
  "createdAt": "2026-03-11T14:30:00.000Z"
}
```

**Status lifecycle:**
```
PENDING → ACCEPTED → COMPLETED
                ↘ DECLINED
```

- `PENDING`: Expert hasn't responded yet
- `ACCEPTED`: Expert accepted the request. `respondedAt` is set.
- `DECLINED`: Expert declined. `respondedAt` is set.
- `COMPLETED`: Expert linked a completed vetting/deliverable to this request.

**Security:** A customer can only poll requests created by their own API key (`sourceCustomerId` must match).

### 4.3 How each app should use the contact API

| App | `subject` convention | `governingLaw` | Notes |
|-----|---------------------|----------------|-------|
| **DPO Central** | "DPO Assessment", "GDPR Audit", "DPIA Review" | Set to the relevant jurisdiction | Privacy-specific requests |
| **AI Sentinel** | "AI Act Compliance", "Risk Assessment", "Model Audit" | Usually `SPAIN` (EU) | AI governance requests |
| **VendorWatch** | "Vendor Due Diligence", "DPA Review", "Subprocessor Audit" | Set to vendor's jurisdiction | Vendor risk requests |
| **Clausemaster** | (not applicable — Clausemaster tracks skill revenue, not contact requests) | — | — |

---

## 5. Deal Outcomes (Read-Only)

When an expert participates in a Dealroom negotiation (via the lawyer vetting flow), LexBooks can fetch the deal outcomes.

### 5.1 List deals

```
GET /api/v1/agent/deals
Scope: deals:read

Response:
{
  "deals": [{
    "id": "clxyz...",
    "name": "NDA — Acme × Widget",
    "contractType": "NDA",
    "governingLaw": "CALIFORNIA",
    "language": "en",
    "status": "AGREED",
    "initiator": { ... },
    "respondent": { ... },
    "createdAt": "...",
    "resolvedAt": "..."
  }]
}
```

### 5.2 Get deal details

```
GET /api/v1/agent/deals/:id
Scope: deals:read

Response includes:
- Agreed clauses with chosen options
- Satisfaction scores per party (0-100%)
- Compromise reasoning
- Overall deal satisfaction
```

### 5.3 Download agreed PDF

```
GET /api/v1/agent/deals/:id/document
Scope: deals:read
Requires: deal status = AGREED

Returns: application/pdf
```

---

## 6. Data Model Reference

### RecommendationRequest (the request record)

```
id                       String     Primary key
requesterId              String?    Dealroom User ID (null for external requests)
lawyerId                 String     Expert's User ID
contractType             String     Subject line / contract type
governingLaw             Enum?      CALIFORNIA | ENGLAND_WALES | SPAIN (null = cross-jurisdiction)
message                  String?    Free-text message from requester
status                   Enum       PENDING | ACCEPTED | DECLINED | COMPLETED
vettingId                String?    Links to a completed LawyerVetting (if applicable)
respondedAt              DateTime?  When expert accepted/declined
createdAt                DateTime
updatedAt                DateTime

-- External request fields (populated by API, null for internal requests)
sourceApp                String?    e.g. "DPO Central"
sourceCustomerId         String?    FK to Customer table
externalRequesterName    String?    Name from the API call
externalRequesterEmail   String?    Email from the API call
externalRequesterCompany String?    Company from the API call
```

### LawyerProfile (the expert record)

```
id                  String      Primary key
userId              String      FK to User (unique)
bio                 String?     Free-text biography (max 2000 chars)
jurisdictions       Enum[]      Practice jurisdictions: CALIFORNIA, ENGLAND_WALES, SPAIN
languages           String[]    ISO 639-1 codes (e.g. "en", "es")
isPublished         Boolean     Controls visibility in directory and API
title               String?     Professional title (max 200 chars)
expertTypes         String[]    TECHNICAL, DEPLOYMENT (non-exclusive; LEGAL retired 2026-07)
specializations     String[]    Taxonomy codes (see Section 3.3)
certifications      String[]    Taxonomy codes (see Section 3.3)
countryCode         String?     ISO 3166-1 alpha-2
city                String?
jurisdictionsCovered String[]   Broader: EU, UK, US, CA, LATAM, APAC
contactUrl          String?     Contact form or mailto link
acceptingClients    Boolean     Whether actively accepting new work
```

### Customer (API consumer)

```
id                  String      Primary key
name                String      e.g. "DPO Central", "AI Sentinel"
email               String      Unique admin email
type                Enum        SAAS | SELF_HOSTED
stripeCustomerId    String?     For billing
```

---

## 7. LexBooks Unified Inbox — Recommended Architecture

LexBooks should aggregate requests from all sources. Here's the recommended approach:

### 7.1 Polling strategy

LexBooks should maintain its own database of request records, synced from Dealroom:

1. **On first load:** For each app (DPO Central, AI Sentinel, VendorWatch), call `GET /api/v1/experts/requests/:id` for all known request IDs
2. **Background sync:** Poll every 60 seconds for requests in `PENDING` status (they're the ones that can change)
3. **Cache settled requests:** Once a request reaches `ACCEPTED`, `DECLINED`, or `COMPLETED`, cache it locally and stop polling

### 7.2 Future: webhooks

Dealroom does not currently support webhooks. When it does, LexBooks should subscribe to:
- `request.status_changed` — Expert accepted/declined/completed a request
- `deal.agreed` — A negotiation reached agreement
- `deal.signed` — A deal was fully signed

Until webhooks are available, polling is the only option.

### 7.3 Inbox data model (LexBooks side)

```sql
CREATE TABLE inbox_items (
  id              TEXT PRIMARY KEY,
  dealroom_id     TEXT NOT NULL,          -- RecommendationRequest.id
  expert_user_id  TEXT NOT NULL,          -- Expert's Dealroom User ID
  source_app      TEXT NOT NULL,          -- "DPO Central", "AI Sentinel", etc.
  subject         TEXT NOT NULL,
  requester_name  TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_company TEXT,
  message         TEXT,
  governing_law   TEXT,                   -- Nullable
  status          TEXT NOT NULL,          -- Synced from Dealroom
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL,
  last_synced_at  TIMESTAMPTZ NOT NULL,

  -- LexBooks-specific fields (not in Dealroom)
  expert_notes    TEXT,                   -- Expert's private notes
  invoiced        BOOLEAN DEFAULT FALSE,
  invoice_amount  INTEGER,               -- Cents
  task_ids        TEXT[],                 -- Links to LexBooks tasks
);
```

### 7.4 Unified view for experts

The inbox should show:

| Column | Source |
|--------|--------|
| Subject | `contractType` from RecommendationRequest |
| From | `externalRequesterName` + `externalRequesterCompany` |
| Source App | `sourceApp` badge (DPO Central / AI Sentinel / VendorWatch / Dealroom) |
| Jurisdiction | `governingLaw` (may be null for non-legal requests) |
| Status | PENDING / ACCEPTED / DECLINED / COMPLETED |
| Date | `createdAt` |

Internal Dealroom requests (where `sourceApp` is null) come from the Dealroom lawyer directory directly. These have a `requesterId` pointing to a Dealroom user instead of external requester fields.

---

## 8. Skill Revenue Tracking (Clausemaster → LexBooks)

This is a separate integration from the contact request flow. When experts publish premium skills via Clausemaster, LexBooks should track the revenue.

**Current Dealroom data model:**

- `SkillPackage` — The published skill (has `stripePriceId`, `priceAmount`, `priceCurrency`)
- `SkillEntitlement` — A customer's license to use a skill (has `stripeSubscriptionId`)
- `SkillActivation` — Individual activations by customer

**Revenue tracking approach:**

LexBooks should query the Stripe API directly (using the same `STRIPE_SECRET_KEY` or a restricted key) to get:
- Subscription revenue per skill (`metadata.skillId` on Stripe subscriptions)
- Payout history
- MRR by skill

This is outside Dealroom's API surface — it's a Stripe integration. Dealroom stores `stripeSubscriptionId` on each entitlement, which LexBooks can use to cross-reference.

---

## 9. Migration Plan: Moving the Expert Inbox to LexBooks

The current expert inbox lives at `dealroom.todo.law/lawyers/requests`. To migrate to LexBooks:

### Phase 1: Shadow mode (now)
- LexBooks reads from Dealroom API (polling)
- Experts continue using Dealroom inbox as primary
- LexBooks shows same data as a secondary view

### Phase 2: Primary inbox (future)
- Add a `POST /api/v1/experts/requests/:id/respond` endpoint to Dealroom so LexBooks can accept/decline on behalf of the expert
- LexBooks becomes the primary inbox
- Dealroom inbox shows "Manage in LexBooks" link

### Phase 3: Full migration (later)
- Contact requests route directly to LexBooks
- Dealroom becomes a pure API backend for experts
- LexBooks handles all notifications, tasks, invoicing

### What Dealroom needs to build for Phase 2
1. `POST /api/v1/experts/requests/:id/respond` — Accept/decline via API (new scope: `experts:manage`)
2. `GET /api/v1/experts/requests` — List all requests for an expert (new endpoint, paginated, filterable by status)
3. Webhook support for real-time status updates

---

## 10. Quick Start Checklist

1. Get a Customer record created in Dealroom admin (`/admin/customers`)
2. Generate an API key with scopes: `experts:read`, `experts:contact`, `deals:read`
3. Store the raw key securely (it's shown only once)
4. Test with:
   ```bash
   # Search experts
   curl -X POST https://dealroom.todo.law/api/v1/experts/search \
     -H "Authorization: Bearer drk_YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"limit": 5}'

   # Send contact request
   curl -X POST https://dealroom.todo.law/api/v1/experts/USER_ID/contact \
     -H "Authorization: Bearer drk_YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "requesterName": "Test User",
       "requesterEmail": "test@example.com",
       "subject": "Test Request",
       "message": "Testing the integration"
     }'

   # Poll status
   curl https://dealroom.todo.law/api/v1/experts/requests/REQUEST_ID \
     -H "Authorization: Bearer drk_YOUR_KEY"
   ```
5. Build the LexBooks inbox UI, syncing from the polling endpoints
6. Set `sourceApp` to your app name (e.g. "LexBooks") when sending requests on behalf of other apps
