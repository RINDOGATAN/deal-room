# Agent Negotiation API

REST API for automated contract negotiation between AI agents. Companies pre-configure negotiation preferences ("playbooks") with red lines, then deploy agents that negotiate contracts against each other using Dealroom's weighted compromise engine.

**Base URL:** `https://dealroom.todo.law/api/v1/agent`

---

## Authentication

All requests require a Bearer token with the `drk_` prefix:

```
Authorization: Bearer drk_exampleexampleexample
```

API keys are created by a Platform Admin at `/admin/customers`. The raw key is shown **once** on creation and cannot be retrieved later — only a prefix (`drk_example`) and hash are stored.

### Scopes

Each API key has a set of scopes that control access:

| Scope | Grants access to |
|-------|-----------------|
| `templates:read` | List and view contract templates |
| `playbook:read` | List and view own playbooks |
| `playbook:write` | Create, update, and delete playbooks |
| `negotiate` | Initiate and join negotiations |
| `deals:read` | List deals, view details, download documents |

A key missing a required scope receives `403 Forbidden`.

### Error Responses

All endpoints return errors in a consistent format:

```json
{ "error": "Description of what went wrong" }
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request — missing or invalid parameters |
| `401` | Unauthorized — missing or invalid API key |
| `403` | Forbidden — valid key but missing scope or access |
| `404` | Not found |
| `409` | Conflict — duplicate name, already joined, etc. |
| `429` | Rate limit exceeded — retry after the seconds in the `Retry-After` header |
| `500` | Internal server error |
| `503` | Service unavailable — typically a downstream dependency (Gavel, Stripe) is misconfigured or unreachable |

---

## Idempotency

All mutating POST endpoints accept an optional `Idempotency-Key` header. Send it on retries to receive the original response without re-executing the handler — the same dealId, the same playbookId, the same checkout URL, etc.

```
POST /api/v1/agent/negotiate
Authorization: Bearer drk_...
Idempotency-Key: 9f7e3b1c-2a4d-4e6f-8c1a-b3d5e7f9a0c2
Content-Type: application/json
```

**Behavior:**
- The first request with a given key runs the handler normally and caches the 2xx response.
- Subsequent requests within 24 hours that send the same key return the cached response with an extra header: `Idempotent-Replay: true`.
- Non-2xx responses (4xx and 5xx) are not cached — a retry with the same key after a failure runs the handler fresh.
- Keys are scoped per customer, so different customers can use the same key value without conflict.

**Format constraints:**
- Maximum 200 characters.
- Allowed characters: letters, digits, underscore (`_`), dash (`-`). Anything else returns 400.

**Endpoints that support the header:**

| Method | Path |
|--------|------|
| POST | `/api/v1/agent/negotiate` |
| POST | `/api/v1/agent/negotiate/join` |
| POST | `/api/v1/agent/playbooks` |
| POST | `/api/v1/agent/subscribe` |
| POST | `/api/v1/agent/webhooks` |
| POST | `/api/v1/agent/deals/:id/accept` |
| POST | `/api/v1/agent/deals/:id/reject` |
| POST | `/api/v1/agent/deals/:id/counter` |
| POST | `/api/v1/agent/deals/:id/dispute` |

The `.well-known/agent.json` discovery document advertises this same list under `capabilities.idempotency.appliesTo` so federated agents can discover what is safe to retry.

**Recommended pattern:** generate a fresh key for each logical action your agent attempts (e.g. one per deal-creation intent), store it locally, and re-send the same key for any retry of that intent. This way a network blip or a transient 5xx never causes a duplicate deal, playbook, or counter-round.

---

## Health Check

`GET /api/health` — public, no auth, no rate limit. Returns a JSON snapshot suitable for any uptime probe.

```json
{
  "ok": true,
  "time": "2026-05-02T10:00:00.000Z",
  "commit": "862978e",
  "version": "0.1.0",
  "services": {
    "database": "ok",
    "databaseLatencyMs": 14
  }
}
```

HTTP 200 when everything works, HTTP 503 with the same shape (with `ok: false` and `database: "unreachable"`) when the database probe fails. `Cache-Control: no-store` defeats CDN caching so a monitor always sees a fresh reading.

---

## Negotiation Flow

```
┌──────────────┐                              ┌──────────────┐
│  Initiator   │                              │  Respondent  │
│    Agent     │                              │    Agent     │
└──────┬───────┘                              └──────┬───────┘
       │                                             │
       │  1. POST /playbooks                         │
       │     (create negotiation preferences)        │
       │                                             │
       │  2. POST /negotiate                         │
       │     → negotiationToken                      │
       │                                             │
       │  3. Send token out-of-band ─────────────────│
       │     (email, API, webhook)                   │
       │                                             │
       │                              4. POST /playbooks
       │                                 (if not already created)
       │                                             │
       │                              5. POST /negotiate/join
       │                                 {token + playbookId}
       │                                             │
       │     ┌───────────────────────────────────┐   │
       │     │  Server resolves automatically:   │   │
       │     │  red lines → compromise → agree   │   │
       │     └───────────────────────────────────┘   │
       │                                             │
       │  6. GET /deals/:id                          │
       │     (agreed clauses + satisfaction)          │
       │                                             │
       │  7. GET /deals/:id/document                 │
       │     (download PDF or DOCX)                  │
       └─────────────────────────────────────────────┘
```

---

## Endpoints

### Templates

#### List Templates

```
GET /templates
Scope: templates:read
```

Returns available contract templates filtered by the customer's entitlements. Free templates (e.g., DPA) are always included; premium templates require an active entitlement.

**Response:**

```json
{
  "templates": [
    {
      "contractType": "DPA",
      "displayName": "Data Processing Agreement",
      "description": "Controller-to-Processor agreement for SaaS companies...",
      "version": "1.0",
      "jurisdictions": ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"],
      "languages": ["en", "es"],
      "category": "Privacy",
      "isPremium": false,
      "clauseCount": 18,
      "clauses": [
        {
          "clauseId": "scope-processing",
          "title": "Scope of Processing",
          "category": "Processing",
          "order": 1,
          "plainDescription": "What types of personal data will the processor handle...",
          "isRequired": true
        }
      ]
    }
  ]
}
```

#### Get Template Detail

```
GET /templates/:contractType
Scope: templates:read
```

Returns full template with all clauses and their options. Use this to understand which `clauseId` and option `code` values to use when building a playbook.

**Response:**

```json
{
  "contractType": "DPA",
  "displayName": "Data Processing Agreement",
  "description": "...",
  "version": "1.0",
  "jurisdictions": ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"],
  "languages": ["en", "es"],
  "category": "Privacy",
  "isPremium": false,
  "clauses": [
    {
      "clauseId": "data-retention",
      "title": "Data Retention Period",
      "category": "Data Handling",
      "order": 1,
      "plainDescription": "How long can the processor retain personal data...",
      "isRequired": true,
      "options": [
        {
          "code": "30-days",
          "label": "30 Days",
          "order": 1,
          "plainDescription": "Processor must delete or return all personal data within 30 days...",
          "biasPartyA": 0.3,
          "biasPartyB": -0.3
        },
        {
          "code": "60-days",
          "label": "60 Days",
          "order": 2,
          "plainDescription": "Processor has 60 days to delete or return...",
          "biasPartyA": 0,
          "biasPartyB": 0
        },
        {
          "code": "90-days",
          "label": "90 Days",
          "order": 3,
          "plainDescription": "Processor has 90 days...",
          "biasPartyA": -0.3,
          "biasPartyB": 0.3
        }
      ]
    }
  ]
}
```

The `biasPartyA` and `biasPartyB` values (`-1` to `1`) indicate how much each option favors Party A (initiator/controller) or Party B (respondent/processor). These feed into the compromise algorithm.

---

### Playbooks

A playbook captures a company's negotiation preferences for a specific contract type: which option they prefer for each clause, how important it is, how flexible they are, and which clauses are non-negotiable red lines.

#### List Playbooks

```
GET /playbooks
Scope: playbook:read
```

**Response:**

```json
{
  "playbooks": [
    {
      "id": "cmlkzold10001s5ray8cyf1r2",
      "name": "Conservative DPA",
      "contractType": "DPA",
      "governingLaw": "ENGLAND_WALES",
      "contractLanguage": "en",
      "isDefault": false,
      "entryCount": 18,
      "createdAt": "2026-02-13T14:34:56.678Z",
      "updatedAt": "2026-02-13T14:34:56.678Z"
    }
  ]
}
```

#### Create Playbook

```
POST /playbooks
Scope: playbook:write
Content-Type: application/json
```

**Request body:**

```json
{
  "name": "Conservative DPA",
  "contractType": "DPA",
  "governingLaw": "ENGLAND_WALES",
  "contractLanguage": "en",
  "isDefault": false,
  "metadata": { "department": "Legal" },
  "entries": [
    {
      "clauseId": "data-retention",
      "preferredOptionId": "30-days",
      "priority": 4,
      "flexibility": 2,
      "isRedLine": true,
      "acceptableOptions": ["30-days", "60-days"],
      "notes": "Board policy requires 60 days max"
    },
    {
      "clauseId": "scope-processing",
      "preferredOptionId": "narrow",
      "priority": 5,
      "flexibility": 1,
      "isRedLine": true,
      "acceptableOptions": ["narrow"]
    }
  ]
}
```

**Field reference:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique per customer |
| `contractType` | string | Yes | Must match a template (e.g., `"DPA"`) |
| `governingLaw` | string | Yes | `CALIFORNIA`, `ENGLAND_WALES`, or `SPAIN` |
| `contractLanguage` | string | No | `"en"` (default) or `"es"` |
| `isDefault` | boolean | No | If `true`, unsets other defaults for this contractType |
| `metadata` | object | No | Arbitrary JSON metadata |
| `entries` | array | Yes | One entry per clause (required clauses must be included) |

**Entry fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `clauseId` | string | Yes | — | Logical clause ID from the template |
| `preferredOptionId` | string | Yes | — | Option `code` from the template (not database ID) |
| `priority` | integer | No | `3` | 1–5, how important this clause is |
| `flexibility` | integer | No | `3` | 1–5, how willing to compromise |
| `isRedLine` | boolean | No | `false` | If `true`, this clause is non-negotiable |
| `acceptableOptions` | string[] | No | `[]` | Option codes that are acceptable. Empty = only preferred is acceptable when `isRedLine` is `true`; any option when `false` |
| `notes` | string | No | — | Internal notes (never shared with counterparty) |

**Validation rules:**
- Every `clauseId` must exist in the referenced template
- Every `preferredOptionId` must be a valid option `code` for that clause
- All `acceptableOptions` values must be valid option codes
- All required clauses in the template must have entries

**Response:** `201 Created` with the full playbook including entries.

#### Get Playbook

```
GET /playbooks/:id
Scope: playbook:read
```

Returns the playbook with all entries. Only returns playbooks owned by the authenticated customer.

#### Update Playbook

```
PUT /playbooks/:id
Scope: playbook:write
Content-Type: application/json
```

Partial updates supported. If `entries` is provided, all existing entries are replaced.

```json
{
  "name": "Updated Name",
  "governingLaw": "SPAIN",
  "entries": [...]
}
```

#### Delete Playbook

```
DELETE /playbooks/:id
Scope: playbook:write
```

**Response:**

```json
{ "success": true }
```

---

### Negotiation

#### Initiate Negotiation

```
POST /negotiate
Scope: negotiate
Content-Type: application/json
```

Creates a pending deal and returns a `negotiationToken` for the respondent.

**Request body:**

```json
{
  "playbookId": "cmlkzold10001s5ray8cyf1r2",
  "dealName": "Alpha-Beta DPA 2026",
  "initiatorCompany": "Alpha Corp",
  "initiatorEmail": "legal@alpha.com",
  "respondentCompany": "Beta Inc",
  "respondentEmail": "legal@beta.com"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `playbookId` | string | Yes | ID of the initiator's playbook |
| `dealName` | string | Yes | Human-readable deal name |
| `initiatorEmail` | string | Yes | Initiator's contact email |
| `initiatorCompany` | string | No | Defaults to customer name |
| `respondentCompany` | string | No | Pre-fill respondent company |
| `respondentEmail` | string | No | Pre-fill respondent email |

**Response:** `201 Created`

```json
{
  "agentDealRoomId": "cmlkzopbt0015s5rahyf2e0ah",
  "negotiationToken": "nt_538b26cf6e1bd2b1001f774317bb55d3015e97fc8f6891c2",
  "status": "PENDING_RESPONDENT",
  "contractType": "DPA",
  "governingLaw": "ENGLAND_WALES",
  "dealName": "Alpha-Beta DPA 2026",
  "createdAt": "2026-02-13T14:35:01.817Z"
}
```

Send the `negotiationToken` to the counterparty out-of-band (email, webhook, API call, etc.).

#### Join Negotiation

```
POST /negotiate/join
Scope: negotiate
Content-Type: application/json
```

Respondent joins with the token and their playbook. The server resolves the negotiation **synchronously** and returns the result.

**Request body:**

```json
{
  "negotiationToken": "nt_538b26cf6e1bd2b1001f774317bb55d3...",
  "playbookId": "cmlkzonlq000ls5rae5mr9nqj",
  "respondentCompany": "Beta Inc",
  "respondentEmail": "legal@beta.com"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `negotiationToken` | string | Yes | Token from the initiator |
| `playbookId` | string | Yes | ID of the respondent's playbook |
| `respondentEmail` | string | Yes | Respondent's contact email |
| `respondentCompany` | string | No | Defaults to customer name |

**Validation:**
- The playbook must be for the same `contractType` as the deal
- Cannot join your own negotiation (different customer required)
- Token must be in `PENDING_RESPONDENT` state

**Success response — AGREED:**

```json
{
  "status": "AGREED",
  "agentDealRoomId": "cmlkzopbt0015s5rahyf2e0ah",
  "dealRoomId": "cmlkzorvc0017s5ra15pk3r7r",
  "clauses": [
    {
      "clauseId": "data-retention",
      "clauseTitle": "Data Retention Period",
      "agreedOptionId": "cmla185ty000410zjml5b4oxu",
      "agreedOptionLabel": "30 Days",
      "satisfactionInitiator": 100,
      "satisfactionRespondent": 5,
      "reasoning": "Party A (initiator) has indicated this clause is highly important..."
    },
    {
      "clauseId": "liability-cap",
      "clauseTitle": "Liability Cap for Data Breaches",
      "agreedOptionId": "cmla18899001c10zjfnpna3lu",
      "agreedOptionLabel": "1x Annual Fees",
      "satisfactionInitiator": 0,
      "satisfactionRespondent": 96,
      "reasoning": "Party B (respondent) has indicated this clause is highly important..."
    }
  ],
  "overallSatisfaction": {
    "initiator": 82,
    "respondent": 47
  },
  "negotiationLog": { }
}
```

**Failure response — red line conflict:**

```json
{
  "status": "FAILED",
  "agentDealRoomId": "cmlkzq195004ys5raouagthh7",
  "failureReason": "Irreconcilable red line conflicts on 1 clause(s)",
  "conflicts": [
    {
      "clauseId": "scope-processing",
      "reason": "Both parties have irreconcilable red lines on this clause. No common acceptable option exists."
    }
  ]
}
```

---

### Deals

#### List Deals

```
GET /deals
Scope: deals:read
```

Returns all agent deals where the authenticated customer is either the initiator or respondent.

**Response:**

```json
{
  "deals": [
    {
      "id": "cmlkzopbt0015s5rahyf2e0ah",
      "dealRoomId": "cmlkzorvc0017s5ra15pk3r7r",
      "status": "AGREED",
      "contractType": "DPA",
      "governingLaw": "ENGLAND_WALES",
      "contractLanguage": "en",
      "dealName": "Alpha-Beta DPA 2026",
      "initiatorCompany": "Alpha Corp",
      "respondentCompany": "Beta Inc",
      "failureReason": null,
      "resolvedAt": "2026-02-13T14:35:12.969Z",
      "createdAt": "2026-02-13T14:35:01.817Z"
    }
  ]
}
```

**Deal statuses:**

| Status | Description |
|--------|-------------|
| `PENDING_RESPONDENT` | Waiting for respondent to join |
| `NEGOTIATING` | Resolution in progress (transient) |
| `AGREED` | Successfully resolved |
| `FAILED` | Irreconcilable red line conflicts |

#### Get Deal Detail

```
GET /deals/:id
Scope: deals:read
```

Returns the deal outcome including per-clause agreed options, satisfaction scores, and reasoning.

**Response (AGREED deal):**

```json
{
  "id": "cmlkzopbt0015s5rahyf2e0ah",
  "dealRoomId": "cmlkzorvc0017s5ra15pk3r7r",
  "status": "AGREED",
  "contractType": "DPA",
  "governingLaw": "ENGLAND_WALES",
  "contractLanguage": "en",
  "dealName": "Alpha-Beta DPA 2026",
  "initiatorCompany": "Alpha Corp",
  "respondentCompany": "Beta Inc",
  "resolvedAt": "2026-02-13T14:35:12.969Z",
  "createdAt": "2026-02-13T14:35:01.817Z",
  "clauses": [
    {
      "clauseId": "data-retention",
      "title": "Data Retention Period",
      "category": "Data Handling",
      "status": "AGREED",
      "agreedOptionId": "cmla185ty000410zjml5b4oxu",
      "satisfaction": {
        "initiator": 100,
        "respondent": 5,
        "reasoning": "Party A (initiator) has indicated this clause is highly important..."
      }
    }
  ],
  "overallSatisfaction": {
    "initiator": 82,
    "respondent": 47
  }
}
```

For `FAILED` deals, the response includes `failureReason` and `negotiationLog` with conflict details instead of `clauses`.

#### Download PDF

```
GET /deals/:id/document
Scope: deals:read
```

Returns the agreed contract as a PDF file. Only available for deals with status `AGREED`.

**Response:** Binary PDF with headers:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="alpha_beta_dpa_2026_contract.pdf"
```

#### Download DOCX

```
GET /deals/:id/document/docx
Scope: deals:read
```

Returns the agreed contract as a Word document. Only available for deals with status `AGREED`.

**Response:** Binary DOCX with headers:
```
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
Content-Disposition: attachment; filename="alpha_beta_dpa_2026_contract.docx"
```

---

## Compromise Algorithm

The engine resolves divergent clause selections using a weighted stake formula:

```
stake = ((5 - flexibility)/5 * 0.6) + (|bias| * 0.4)
```

> **Note:** The `priority` parameter exists for backward compatibility but is not used in the stake calculation. Flexibility and bias are the two factors that determine each party's stake.

- The party with higher stake gets preference
- If stakes are similar (< 0.1 difference), the middle option is chosen
- If one party has flexibility >= 4, the other party's preference wins
- A **global fairness pass** rebalances if average satisfaction is skewed by > 15%

Red lines override the compromise: if a suggested option falls outside a party's `acceptableOptions`, it is replaced with the best option from the intersection of both parties' acceptable sets.

---

## Playbook Strategy Guide

### Priority (1–5)

How important this clause is to your organization.

| Value | Meaning | Example |
|-------|---------|---------|
| 1 | Not important | Dispute resolution venue |
| 2 | Slightly important | DPIA assistance level |
| 3 | Moderately important | Confidentiality terms |
| 4 | Important | Data retention period |
| 5 | Critical | Scope of processing, breach notification |

### Flexibility (1–5)

How willing you are to accept a different option.

| Value | Meaning | Effect |
|-------|---------|--------|
| 1 | Inflexible | Engine strongly favors your preference |
| 2 | Reluctant | Slight lean toward your preference |
| 3 | Neutral | Balanced compromise |
| 4 | Flexible | Yields to higher-priority counterparty |
| 5 | Very flexible | Almost always yields |

### Red Lines

Mark a clause as `isRedLine: true` to make it non-negotiable. Use `acceptableOptions` to define which options you can live with:

```json
{
  "clauseId": "breach-notification",
  "preferredOptionId": "24h",
  "isRedLine": true,
  "acceptableOptions": ["24h", "48h"]
}
```

- If both parties have red lines on the same clause and their `acceptableOptions` don't overlap, the deal **fails immediately** before any compromise runs.
- If only one party has a red line, the compromise engine respects it and chooses from their acceptable set.
- If `acceptableOptions` is empty and `isRedLine` is `true`, only the `preferredOptionId` is acceptable.

---

## Complete Example

### 1. Discover the template

```bash
curl https://dealroom.todo.law/api/v1/agent/templates/DPA \
  -H "Authorization: Bearer drk_YOUR_KEY"
```

### 2. Create playbooks (both companies)

```bash
# Company A (controller)
curl -X POST https://dealroom.todo.law/api/v1/agent/playbooks \
  -H "Authorization: Bearer drk_COMPANY_A_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Standard DPA",
    "contractType": "DPA",
    "governingLaw": "ENGLAND_WALES",
    "entries": [
      {
        "clauseId": "data-retention",
        "preferredOptionId": "30-days",
        "priority": 4,
        "flexibility": 2,
        "isRedLine": true,
        "acceptableOptions": ["30-days", "60-days"]
      },
      {
        "clauseId": "scope-processing",
        "preferredOptionId": "narrow",
        "priority": 5,
        "flexibility": 1
      }
    ]
  }'
```

### 3. Initiate negotiation

```bash
curl -X POST https://dealroom.todo.law/api/v1/agent/negotiate \
  -H "Authorization: Bearer drk_COMPANY_A_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "playbookId": "PLAYBOOK_A_ID",
    "dealName": "Acme-Widget DPA Q1 2026",
    "initiatorEmail": "legal@acme.com",
    "respondentEmail": "legal@widget.com"
  }'
# → { "negotiationToken": "nt_abc123...", ... }
```

### 4. Send token to counterparty (out-of-band)

The initiator sends `nt_abc123...` to the respondent via email, Slack, API webhook, etc.

### 5. Respondent joins

```bash
curl -X POST https://dealroom.todo.law/api/v1/agent/negotiate/join \
  -H "Authorization: Bearer drk_COMPANY_B_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "negotiationToken": "nt_abc123...",
    "playbookId": "PLAYBOOK_B_ID",
    "respondentEmail": "legal@widget.com"
  }'
# → { "status": "AGREED", "clauses": [...], "overallSatisfaction": {...} }
```

### 6. Download the contract

```bash
curl https://dealroom.todo.law/api/v1/agent/deals/DEAL_ID/document \
  -H "Authorization: Bearer drk_COMPANY_A_KEY" \
  -o contract.pdf
```

---

## Entitlements

Premium templates (skills from the `legalskills` repo) require an active subscription entitlement. The **initiator** must hold the entitlement for the template's contract type and jurisdiction. The respondent does not need an entitlement — they are participating in a deal the initiator started.

If the initiator attempts to negotiate with a premium template without entitlement:

```json
{
  "error": "Not entitled to use this template",
  "reason": "No entitlement found for this skill"
}
```

**Status:** `403 Forbidden`

Free templates (NDA, MSA, SaaS, DPA, Privacy Notice) are available to all customers without entitlement.

---

## Rate Limits

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| `/negotiate`, `/negotiate/join` | 100 requests | 1 hour |
| All other agent endpoints | 1,000 requests | 1 hour |

Limits are per-customer (not per API key). When exceeded, the API returns:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 42
```

```json
{ "error": "Rate limit exceeded" }
```

---

## Usage Metering

Every negotiation (both `AGREED` and `FAILED`) is recorded in a `NegotiationUsage` ledger for both the initiator and respondent. Usage can be viewed by admins at `/admin/customers`.

---

## Subscriptions & Billing

Agents use the same subscription model as human users. Premium skills cost **EUR 9/month** (or **$9/month** in the US) per skill. Free skills (NDA, MSA, SaaS, DPA, Privacy Notice) are always available at no cost.

The **initiator's customer** must hold an active subscription. The respondent does not need one.

### Check Subscription Status

```
GET /subscriptions
Scope: billing:read
```

**Response:**

```json
{
  "subscriptions": [
    {
      "id": "clxyz...",
      "skillId": "com.nel.skills.consulting",
      "displayName": "Consulting Agreement",
      "isPremium": true,
      "status": "ACTIVE",
      "licenseType": "SUBSCRIPTION",
      "jurisdictions": ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"],
      "availableJurisdictions": ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"],
      "languages": ["en", "es"],
      "expiresAt": "2026-04-12T00:00:00.000Z",
      "createdAt": "2026-03-12T10:00:00.000Z"
    }
  ]
}
```

### Subscribe to Premium Skills

```
POST /subscribe
Scope: billing:read
Content-Type: application/json
```

```json
{
  "skillIds": ["com.nel.skills.consulting", "com.nel.skills.founders"],
  "returnUrl": "https://your-app.com/callback"
}
```

**Response:**

```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_...",
  "message": "Open this URL in a browser to complete the subscription. Entitlements activate automatically after payment.",
  "skills": [
    {
      "skillId": "com.nel.skills.consulting",
      "displayName": "Consulting Agreement",
      "priceAmount": 900,
      "priceCurrency": "eur"
    }
  ]
}
```

The admin opens `checkoutUrl` in a browser to complete payment. Entitlements are activated automatically via Stripe webhook — the agent can start negotiating immediately after.

If `skillIds` is omitted, the response lists all available premium skills.

### Revenue Share

70% of subscription revenue goes to the skill publisher. 30% is retained by the platform. Revenue share is processed automatically via Stripe Connect when the publisher has a connected account.

---

## Webhooks

Register endpoints to receive real-time event notifications.

### Register Webhook

```
POST /webhooks
Scope: webhooks:manage
Content-Type: application/json
```

```json
{
  "url": "https://your-app.com/webhooks/dealroom",
  "events": ["negotiation.agreed", "negotiation.failed"]
}
```

**Response:** `201 Created`

```json
{
  "id": "clxyz...",
  "url": "https://your-app.com/webhooks/dealroom",
  "events": ["negotiation.agreed", "negotiation.failed"],
  "secret": "whsec_a1b2c3...",
  "isActive": true,
  "createdAt": "2026-03-12T10:00:00.000Z"
}
```

The `secret` is shown **once** on creation. Use it to verify webhook signatures.

### List Webhooks

```
GET /webhooks
Scope: webhooks:manage
```

### Delete Webhook

```
DELETE /webhooks/:id
Scope: webhooks:manage
```

### Event Types

| Event | When |
|-------|------|
| `negotiation.pending` | Deal created, token issued |
| `negotiation.agreed` | Compromise reached |
| `negotiation.failed` | Irreconcilable red lines or rejection |
| `negotiation.suggested` | Suggestions ready (async mode) |
| `negotiation.counter` | Counterparty submitted counter-proposals |

### Signature Verification

All webhook payloads are signed with HMAC-SHA256. Verify using the `X-Dealroom-Signature` header:

```
X-Dealroom-Signature: sha256=abc123...
```

```javascript
const crypto = require("crypto");
const expected = crypto
  .createHmac("sha256", webhookSecret)
  .update(rawBody)
  .digest("hex");
const valid = signature === `sha256=${expected}`;
```

Webhooks retry up to 3 times with exponential backoff (2s, 4s) on failure.

---

## Async Multi-Round Negotiation

In addition to the default synchronous one-round negotiation, agents can use async endpoints for multi-round counter-proposals.

### Submit Counter-Proposals

```
POST /deals/:id/counter
Scope: negotiate
Content-Type: application/json
```

```json
{
  "proposals": [
    {
      "clauseId": "clause_id_here",
      "optionCode": "60-days",
      "rationale": "We need more time for data migration"
    }
  ]
}
```

### Accept Deal

```
POST /deals/:id/accept
Scope: negotiate
```

When both parties accept, the deal moves to `AGREED`.

### Reject Deal

```
POST /deals/:id/reject
Scope: negotiate
```

```json
{ "reason": "Terms are unacceptable" }
```

### Poll Status

```
GET /deals/:id/status
Scope: deals:read
```

Lightweight status check returning current round, party statuses, and resolution info.

---

## Attorney Attestation

When a supervising attorney has approved (vetted) a skill's clauses for a given jurisdiction, agent deals using that skill include an attorney attestation:

```json
{
  "attorneyAttestation": {
    "attorneyName": "Jane Smith, Esq.",
    "barNumber": "CA-123456",
    "statement": "The legal provisions in this contract have been reviewed and attested by Jane Smith, Esq. (Bar No. CA-123456) pursuant to UETA § 14 and the federal E-SIGN Act."
  }
}
```

All agent-generated contracts include a UETA § 14 / E-SIGN Act preamble:

> "This agreement was formed by the interaction of electronic agents of the parties pursuant to the Uniform Electronic Transactions Act § 14 and the Electronic Signatures in Global and National Commerce Act (15 U.S.C. § 7001 et seq.). Each party authorized its electronic agent to negotiate and accept the terms herein."

---

## Dispute Escalation (Gavel ADR)

When negotiation fails or a party alleges breach, disputes can be escalated to Gavel for stablecoin-based arbitration.

```
POST /deals/:id/dispute
Scope: disputes:create
Content-Type: application/json
```

```json
{
  "reason": "Counterparty breached data retention clause",
  "escrowAmount": 50000
}
```

**Response:** `201 Created`

```json
{
  "disputeId": "clxyz...",
  "gavelCaseId": "gavel_abc123",
  "gavelCaseUrl": "https://gavel.todo.law/cases/gavel_abc123",
  "status": "PENDING",
  "createdAt": "2026-03-12T10:00:00.000Z"
}
```

---

## Protocol Discovery

### A2A Agent Card

```
GET /.well-known/agent.json
```

Returns a standard A2A Agent Card describing Dealroom's negotiation capabilities, supported contract types, authentication scheme, and input/output formats. Cached for 5 minutes.

### MCP Tool Definitions

```
GET /api/v1/agent/mcp
```

Returns MCP-compatible tool definitions for Dealroom operations (discovery-only — execution goes through REST endpoints). Includes tools: `list_templates`, `get_template`, `create_playbook`, `initiate_negotiation`, `join_negotiation`, `get_deal`, `download_contract`, `get_credits`.

---

## Scopes Reference

| Scope | Grants access to |
|-------|-----------------|
| `templates:read` | List and view contract templates |
| `playbook:read` | List and view own playbooks |
| `playbook:write` | Create, update, and delete playbooks |
| `negotiate` | Initiate and join negotiations, counter-propose, accept/reject |
| `deals:read` | List deals, view details, poll status, download documents |
| `billing:read` | View subscriptions, initiate subscription checkout |
| `webhooks:manage` | Register, list, and delete webhook endpoints |
| `disputes:create` | Escalate deals to Gavel ADR |
| `experts:read` | Search and view expert profiles |
| `experts:contact` | Send contact requests to experts |

---

## Agent-to-Agent (A2A) Contract Skills

Dealroom offers a suite of A2A contract skills designed specifically for autonomous agent interactions. These skills cover the legal middleware layer that agents need when transacting with each other or with services.

### Available A2A Contract Types

| Contract Type | Description |
|---------------|-------------|
| `A2A_API_ACCESS` | API consumption terms (rate limits, SLAs, data handling) |
| `A2A_TOOL_LICENSE` | Agent tool/skill/plugin licensing |
| `A2A_DATA_SHARING` | Inter-agent data exchange (privacy, retention, purpose limits) |
| `A2A_COMPUTE_PROCUREMENT` | Procurement of compute/storage/GPU resources |
| `A2A_TASK_DELEGATION` | Agent sub-contracting and task delegation |
| `A2A_CONTENT_LICENSE` | AI-generated content licensing |
| `A2A_MARKETPLACE` | Agent marketplace transactions |
| `A2A_ORCHESTRATION` | Multi-agent orchestration liability and coordination |
| `A2A_PAYMENT_AUTHORIZATION` | Agent financial transaction terms |
| `A2A_KNOWLEDGE_ACCESS` | Access to proprietary knowledge bases / RAG sources |
| `A2A_SUPPLY_CHAIN` | Cross-org agent collaboration in supply chains |
| `A2A_MONITORING` | Agent monitoring, audit, and compliance |

All A2A skills are bilingual (EN/ES) and support three jurisdictions: California, England & Wales, and Spain.

### A2A Subscription Model

A2A skills are available under a bundled subscription:

| Tier | Price | Limits |
|------|-------|--------|
| **Standard** | €9/month | 5 invocations per skill per week per customer |
| **Premium** | €60/month | 300 total invocations per week per customer |

When the rate limit is exceeded, the API returns `429 Too Many Requests` with a `Retry-After` header.

Premium tier is activated by setting the `premiumA2A` flag in the customer metadata via the admin panel.

### Gavel Dispute Resolution

All A2A contract skills include a dispute resolution clause with **Gavel Automated Arbitration** as the recommended default option. When parties agree to Gavel arbitration, disputes can be escalated via:

```
POST /api/v1/agent/deals/:id/dispute
Scope: disputes:create
```

Gavel provides electronic arbitration with rapid turnaround, escrow mechanisms, and binding decisions — designed for the speed requirements of agent-to-agent commerce.

---

## Versioning

The API is versioned via the URL path (`/v1/`). Breaking changes will be introduced under a new version prefix.
