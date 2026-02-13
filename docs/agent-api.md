# Agent Negotiation API

REST API for automated contract negotiation between AI agents. Companies pre-configure negotiation preferences ("playbooks") with red lines, then deploy agents that negotiate contracts against each other using Deal Room's weighted compromise engine.

**Base URL:** `https://dealroom.todo.law/api/v1/agent`

---

## Authentication

All requests require a Bearer token with the `drk_` prefix:

```
Authorization: Bearer drk_96eddb08b83dc09b87deafed3deaccc...
```

API keys are created by a Platform Admin at `/admin/customers`. The raw key is shown **once** on creation and cannot be retrieved later — only a prefix (`drk_96eddb08`) and hash are stored.

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
| `500` | Internal server error |

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
stake = (priority/5 * 0.4) + ((5 - flexibility)/5 * 0.3) + (|bias| * 0.3)
```

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

## Rate Limits

No rate limits are enforced in the current version. This may change in future releases.

## Versioning

The API is versioned via the URL path (`/v1/`). Breaking changes will be introduced under a new version prefix.
