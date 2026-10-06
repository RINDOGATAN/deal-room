# Agent Negotiation API

REST API for automated contract negotiation between AI agents. Companies pre-configure negotiation preferences ("playbooks") with red lines, then deploy agents that negotiate contracts against each other using Dealroom's weighted compromise engine.

**Base URL:** `https://dealroom.todo.law/api/v1/agent`

Quick start for developers (keys, credits, MCP client setup): https://dealroom.todo.law/developers

---

## Make a contract in one call

### List contract types (public)

`GET /contract-types[?lang=es]`, no key. Every type the one call accepts (agent-to-agent `A2A_` protocols excluded): `contractType` code, guide `slug`, `governingLaws`, `languages`, `roles` (DPA and BAA; default first), `inputs` (id, label, type, required, `onlyUnder` governing laws, options, default, hint), `clauseCount`, the guide URLs and the `details` URL (`/templates/:contractType`, behind a key).

### Generate a contract

`POST /contracts`. Scopes `negotiate` and `deals:read`. Honors `Idempotency-Key`. Hourly limit of the `negotiate` group (100 per customer).

```json
{
  "contractType": "NDA",
  "governingLaw": "CALIFORNIA",
  "language": "en",
  "title": "optional deal name",
  "party": { "legalName": "Your Company, Inc.", "address": "...", "taxId": "...", "signatoryName": "...", "signatoryTitle": "CEO", "email": "..." },
  "counterparty": { "legalName": "Other Company, LLC" },
  "role": "PROCESSOR",
  "terms": { "input-id": "value" },
  "clauses": { "clause-id": "option-code" },
  "inline": "md"
}
```

- `contractType`: the code, the code in any case, or the guide slug. `party.legalName` is the only other required field.
- `governingLaw`: required only when the type offers more than one (Delaware formations run under `CALIFORNIA` and need none).
- `terms`: inputs left out take their default (as the wizard pre-fills them); required inputs without a default must be sent, else 422 `Missing required parameters` with the list.
- Clauses left out take the skill's baseline option (solo intake with `selectionPolicy: "defaults"`). The deal is a SOLO deal: `party` becomes the initiator's signing details, `counterparty` is stored on the deal (`soloCounterparty`) and fills the other block; without it that block stays blank.
- Payment: with billing on, a customer with no credit gets **402** `PAYMENT_REQUIRED` before anything is created. Otherwise the deal is paid exactly as the first document download (`dealAccessForAgent`: one credit), so later downloads are free. If the last credit is spent elsewhere in between, the answer is 402 with the `dealId` (fetch `/deals/:id/document` once a credit is back).
- Answer **201**: `dealId` (agent deal id, for `/deals/:id/...`), `dealRoomId`, `status: "AGREED"`, `contractType`, `governingLaw`, `language`, `paid`, `dealUrl` (opens in the browser for the person whose e-mail is the customer's; null with `dealUrlNote` when no such account exists), `documents.{pdf,docx,txt,md,html}`, `guide`, and with `inline` (`md`, `html` or `txt`) `document: { format, content }`.

### Formats

Every agreed contract is available in five formats, all rendered from the same document model (`generateContractData`) that feeds the PDF; the Markdown and HTML renderers walk one shared outline (`contractOutline.ts`), so they list the same sections. Paid once per contract (first fetch of any format spends the credit); every later fetch, in any format, is free.

| Format | Path | Media type | Notes |
| --- | --- | --- | --- |
| Markdown | `/deals/:id/document/md` | `text/markdown` | `#` title, `##` sections, `### N. Title` per negotiated clause, parties as field lists, signature blocks, annexes after a rule. Best for agents. |
| HTML | `/deals/:id/document/html` | `text/html` | One self-contained file: no scripts, no external assets, inline styles only (sent with a CSP that allows nothing else). `<article>`, one `<section id="clause-{clauseId}">` per clause, `<dl>` for parties and definitions, `<dfn>` for defined terms. |
| Text | `/deals/:id/document/txt` | `text/plain` | |
| PDF | `/deals/:id/document` | `application/pdf` | |
| DOCX | `/deals/:id/document/docx` | Word | |

### Delete a deal

`DELETE /deals/:id` (`:id` is the `dealId` of the one call). Scope `negotiate`. Deletes one of your single-party deals and its data; it cannot be undone.

- Who: only the account that made the deal (the API key's customer). For any other account the deal does not exist: **404**, as it does once deleted, so a repeated delete answers 404.
- Which deals: single-party (SOLO) deals made through the agent API (`POST /contracts` or the solo intake `POST /deals`). A deal another party takes part in (a two-party negotiation, a deal another account joined, a dispute, an accepted invitation) is refused with **409** `NOT_SINGLE_PARTY` and nothing is deleted.
- Deleted: the deal, its parties and their signing details, the other side's details (`soloCounterparty`), the clause choices, the inputs (terms), compromise records, rounds, invitations, the signing request, notification records, the deal's audit entries and the cached idempotent answers that hold it. Documents are made on request and never stored, so no file remains.
- Kept, for billing and the law: the payment record (amount, currency, date, account, payment references and deal id, copied to `deleted_deal_payments`), the credit ledger entry (one credit spent, date, account, deal id), the usage meter and one audit entry that the deletion happened, all without party names or contract text. A spent credit is not given back.
- Answer **204** with no body. Errors: 401 no key, 403 scope, 404 not found, 409 not a single-party deal.

MCP: `delete_deal` with `{ "dealId": "..." }` runs this route (same rules); a 404 or 409 comes back as a tool error.

The one call returns the Markdown, HTML or text in the answer with `inline`; MCP `generate_contract` asks for Markdown by default and puts it first in the tool result; `download_contract` defaults to Markdown.
- Errors: 400 invalid body, 401 no key, 403 scope, 404 unknown type (with a hint), 422 law, language, role, inputs, selections or an unsettled clause (nothing charged), 429 limit.

### MCP

`POST /mcp` is the MCP server (Streamable HTTP, JSON answers, no sessions; methods `initialize`, `ping`, `tools/list`, `tools/call`). The key goes in the `Authorization` header; connecting and listing tools work without it. Each tool runs its REST route, so prices and limits are the same. `GET /mcp` still returns the tool list as JSON with each tool's endpoint. Tools: `list_contract_types` (public), `generate_contract`, `list_templates`, `get_template`, `create_playbook`, `initiate_negotiation`, `join_negotiation`, `get_deal`, `download_contract` (Markdown by default; Markdown, HTML and text come back as text, PDF and DOCX as embedded resources), `delete_deal` (marked destructive), `buy_credits`, `get_credit_balance`, `get_subscriptions`.

---

## Authentication

All requests require a Bearer token with the `drk_` prefix:

```
Authorization: Bearer drk_exampleexampleexample
```

On hosted Dealroom (agent API and billing on), you create your key yourself: sign in, open **Settings, API keys** (https://dealroom.todo.law/settings/api-keys) and choose **Create key**. An account can hold up to 5 active keys; the same page lists them (name, prefix, created, last used), revokes them, shows the credit balance and opens a checkout for a credit pack. On the kit (self-hosted), keys are created by a Platform Admin at `/admin/customers`. Either way the raw key is shown **once** on creation and cannot be retrieved later; only a prefix (`drk_example`) and a hash are stored.

### Scopes

Each API key has a set of scopes that control access:

| Scope | Grants access to |
|-------|-----------------|
| `templates:read` | List and view contract templates |
| `playbook:read` | List and view own playbooks |
| `playbook:write` | Create, update, and delete playbooks |
| `negotiate` | Make contracts, initiate and join negotiations, delete your single-party deals |
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
| `503` | Service unavailable — a downstream dependency (Gavel, Stripe) is not configured or unreachable. The dispute endpoint returns `{ "error": "gavel_not_configured" }` when Gavel is not configured (see Dispute Escalation) |

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
GET /templates?q=nda
Scope: templates:read
```

Returns available contract templates filtered by the customer's entitlements. Free templates (e.g., DPA) are always included; premium templates require an active entitlement.

The optional `q` searches by contract code, abbreviation, synonym or name in English or Spanish (`nda`, `dpa`, `hipaa`, `statement of work`, `confidencialidad`), ignoring case and accents, and returns only the matching templates, best match first (code or abbreviation, then name, then description). The MCP tool `list_templates` takes the same search as `query`.

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

#### Create Solo Deal (fact intake)

```
POST /deals
Scope: negotiate
Content-Type: application/json
Idempotency-Key: <recommended>
```

Creates an **agreed SOLO deal from a fact package** — the integration seam
for suite apps (DPO Central) that hold the customer's stack knowledge while
Dealroom holds the contract know-how. One call returns the finished
document set: contract PDF/DOCX/TXT plus the standalone Transfer Impact
Assessment for DPAs with third-country processors.

**Request body** (schema `dealroom.solo-intake/1`):

```json
{
  "schema": "dealroom.solo-intake/1",
  "contractType": "DPA",
  "governingLaw": "SPAIN",
  "language": "en",
  "dealName": "Acme Corp DPA",
  "initiatorCompany": "Acme Corp S.L.",
  "fillRole": "PROCESSOR",
  "selectionPolicy": "defaults",
  "selections": {
    "breach-notification": "72h",
    "subprocessor-approval": "general-30d",
    "government-access-requests": "commitments"
  },
  "parameters": {
    "processing-purpose": "Providing the contracted SaaS analytics service.",
    "data-categories": "contact-details,usage-technical",
    "processor-establishment": "US",
    "subprocessor-list": "AWS EMEA SARL (cloud hosting, EU-West)"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `contractType` | string | Yes | Template contract type (e.g. `DPA`) |
| `governingLaw` | string | Yes | Must be offered by the template |
| `dealName` | string | Yes | Human-readable deal name |
| `language` | string | No | Contract language, default `en` |
| `fillRole` | string | No | Asymmetric-role contracts (DPA: `PROCESSOR`/`CONTROLLER`) |
| `parameters` | object | No | Wizard parameters by authored id; required ones enforced |
| `selections` | object | No | `clauseId` → option **code** or authored optionId |
| `selectionPolicy` | string | No | `explicit` (default) or `defaults` — fill unspecified clauses with the jurisdiction baseline |

Clause/option identifiers are skill-authored and stable across reseeds;
introspect the catalog via `GET /templates/:contractType`. Unknown clauses,
unknown options, or options unavailable in the chosen jurisdiction fail
with `422` listing them. Missing required parameters fail with `422`.

**Response:** `201 Created`

```json
{
  "agentDealRoomId": "cmlkzopbt0015s5rahyf2e0ah",
  "status": "AGREED",
  "unresolvedClauseIds": [],
  "documents": {
    "pdf": "/api/v1/agent/deals/…/document",
    "docx": "/api/v1/agent/deals/…/document/docx",
    "txt": "/api/v1/agent/deals/…/document/txt",
    "tia": "/api/v1/agent/deals/…/tia"
  }
}
```

With `selectionPolicy: "explicit"`, unspecified multi-option clauses are
returned in `unresolvedClauseIds`, the deal stays `NEGOTIATING`, and
`documents` is `null` until the clauses are resolved in the UI.

#### Download Transfer Impact Assessment

```
GET /deals/:id/tia
Scope: deals:read
```

Produces the DPA's Annex IV as its own PDF, on demand (the SCC Clause 14
production duty). Supports `?whitelabel=1` to strip platform branding.
`404` when the deal carries no TIA annex (EEA processor or TIA declined).
The contract downloads (`/document`, `/document/docx`, `/document/txt`)
also accept `?whitelabel=1` on the PDF variant.

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

#### Delete a Deal

```
DELETE /deals/:id
Scope: negotiate
```

Deletes one of your single-party deals and its data (see "Delete a deal" above for what is deleted and what is kept). **204** with no body; **404** when the deal is not yours or is already deleted; **409** `NOT_SINGLE_PARTY` when another party takes part in it.

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

Where payments are on, this first fetch spends one credit of the key's
customer; with no credit left it answers **402** with the link to buy
credits. See [Paying per contract](#paying-per-contract).

---

## Entitlements

Every template, premium ones included, is available to every API key
without a skill entitlement. Negotiating is always free. Where payments are
on, what is paid is the **contract**: when it is made, for a contract made
in one call (`POST /api/v1/agent/contracts`), or when its document is first
fetched, for a negotiated one (see [Paying per contract](#paying-per-contract)).

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

## Paying per contract

**Your own instance (the kit):** payments are off. Every contract is free;
the credit endpoints below answer **409** `{ "error": "Payments are disabled; every contract is free" }`
(the retired `POST /subscribe` answers 410 everywhere).
Premium skills for your own instance are bought on the todo.law storefront
and activated offline with a licence file.

**Where payments are on (hosted Dealroom, once billing is switched on):**

- Drafting and negotiating are free, whatever the template.
- A contract is paid **once**, the first time an agent fetches the document
  of an agreed deal (`GET /deals/:id/document`, `/document/docx` or
  `/document/txt`). One **prepaid credit** is spent. Later fetches of the
  same deal, by any key, are free.
- **Credits belong to the customer**, not to a key. Every API key of the
  customer spends from the one balance; rotating or revoking a key changes
  nothing. The ledger notes which key bought or spent each credit.
- Credits are sold in **packs of ten, at 25 percent off** the single price.
  The single price is the same for agents and people.
- There is no subscription or monthly plan. `POST /subscribe` answers
  **410 Gone** with a plain message and the link to buy credits.
- Deals created before the deployment's billing start date are never
  charged.
- If the deal is not paid and the customer has no credit, the document
  endpoints answer **402 Payment Required**:

```json
{
  "error": "This contract is not paid yet and your account has no credits left. Buy a pack of ten credits (POST /api/v1/agent/credits/checkout); any API key of the account spends them, one credit when an agreed contract is first fetched.",
  "code": "PAYMENT_REQUIRED",
  "checkout": { "method": "POST", "url": "/api/v1/agent/credits/checkout" },
  "balance": { "method": "GET", "url": "/api/v1/agent/credits/balance" }
}
```

The amounts are machine-readable in `/.well-known/agent.json` and in the MCP
discovery document, under `pricing`: `amountsMinorUnits` (e.g. `2900` =
29.00, per currency, read from the deployment's Stripe prices, so always
what Stripe charges) and `display` (the text shown to people). The block
also states `creditsHeldBy: "customer"`.

### Buy a pack of ten credits

```
POST /credits/checkout
Scope: billing:read
Content-Type: application/json
```

```json
{ "currency": "eur", "returnUrl": "https://your-app.example/after-payment" }
```

Both fields are optional (`currency` defaults to `usd`).

**Response:**

```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_...",
  "credits": 10,
  "currency": "eur"
}
```

A person opens `checkoutUrl` in a browser to pay. The credits are added to
the balance of **the key's customer** when the payment succeeds (Stripe
webhook); any key of the customer can then spend them. A fully refunded pack
is taken back (a partial refund keeps it); if some credits were already
spent, the balance can go below zero and blocks new spending until topped
up.

### Check the balance

```
GET /credits/balance
Scope: billing:read
```

```json
{
  "billing": "per_contract",
  "heldBy": "customer",
  "customerId": "clcust...",
  "balance": 9,
  "entries": [
    { "delta": -1, "reason": "CONSUME", "dealRoomId": "cldeal...", "apiKeyId": "clkey2...", "createdAt": "2026-10-02T10:00:00.000Z" },
    { "delta": 10, "reason": "PURCHASE", "dealRoomId": null, "apiKeyId": "clkey1...", "createdAt": "2026-10-01T09:00:00.000Z" }
  ]
}
```

The balance is the customer's: every key of the customer sees the same
number.

### Subscriptions (retired)

```
POST /subscribe
```

Answers **410 Gone** in every posture:

```json
{
  "error": "Subscriptions are no longer offered. Every template is included, and each contract is paid with one prepaid credit when its document is first fetched. Buy credits in packs of ten at POST /api/v1/agent/credits/checkout.",
  "code": "GONE",
  "buyCredits": { "method": "POST", "url": "/api/v1/agent/credits/checkout" }
}
```

### Earlier per-skill subscriptions

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

`GET /subscriptions` still lists subscriptions bought before pay per
contract; they are no longer needed to use any template.

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

Contracts negotiated between two agents (initiated and joined, each side with its own playbook) open with a UETA § 14 / E-SIGN Act notice, in every format (PDF, DOCX, TXT, Markdown, HTML), followed by the attorney attestation when there is one. Single-party contracts made by one agent (`POST /deals`, `POST /contracts`) do not carry it, because no second agent took part:

English contracts:

> "This agreement was formed by two agentic systems negotiating with each other, pursuant to the Uniform Electronic Transactions Act § 14 and the Electronic Signatures in Global and National Commerce Act (15 U.S.C. § 7001 et seq.). Each party authorized its electronic agent to negotiate and accept the terms herein."

Spanish contracts:

> "El presente acuerdo ha sido formado por dos sistemas agénticos que negociaron entre sí, de conformidad con el § 14 de la Uniform Electronic Transactions Act y la Electronic Signatures in Global and National Commerce Act (15 U.S.C. § 7001 y ss.). Cada parte autorizó a su agente electrónico para negociar y aceptar los términos del presente acuerdo."

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

### When arbitration is not available

The hand-off is only made when the deployment is configured with both
`GAVEL_API_URL` and `GAVEL_API_KEY`. When either is missing the endpoint
refuses the request and stores nothing (no dispute record, no case):

```
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{ "error": "gavel_not_configured" }
```

Meaning: no arbitration exists for this deal. Do not retry automatically; the
answer will not change until the operator configures Gavel. A `503` with the
body `{ "error": "Gavel service unavailable" }` means Gavel is configured but
could not be reached, and a later retry may succeed. A `502` means Gavel
rejected the case.

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

Returns MCP-compatible tool definitions for Dealroom operations, each with the REST endpoint it runs (`POST /api/v1/agent/mcp` runs them). Includes tools: `list_templates`, `get_template`, `create_playbook`, `initiate_negotiation`, `join_negotiation`, `get_deal`, `download_contract` (documents the 402 behaviour), `delete_deal`, `get_subscriptions`, `buy_credits`, `get_credit_balance` (the customer's shared balance), plus a `pricing` block with the per-contract amounts. There is no `subscribe` tool: subscriptions are retired.

---

## Scopes Reference

| Scope | Grants access to |
|-------|-----------------|
| `templates:read` | List and view contract templates |
| `playbook:read` | List and view own playbooks |
| `playbook:write` | Create, update, and delete playbooks |
| `negotiate` | Make contracts, initiate and join negotiations, counter-propose, accept/reject, delete your single-party deals |
| `deals:read` | List deals, view details, poll status, download documents |
| `billing:read` | View the customer's credit balance and earlier subscriptions, buy credit packs |
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

### A2A Usage Limits

On hosted Dealroom, every A2A skill is included, with weekly limits; the
contract itself is paid per contract with a prepaid credit (see
[Paying per contract](#paying-per-contract)). On your own instance, premium A2A skills are
60 a year each in the kit (in your currency).

| Tier | Limits |
|------|--------|
| **Standard** | 5 negotiations per contract type per week per customer |
| **Extended** | 300 negotiations a week in total per customer |

Accounts holding credits have the extended limit automatically: a credit
balance above zero, a credit pack bought since the billing start, or a
contract paid since then. To lift the standard limit, buy credits (the
`buy_credits` MCP tool or `POST /api/v1/agent/credits/checkout`; prices at
https://dealroom.todo.law/pricing). An administrator can also grant the
extended limit with the `premiumA2A` flag in the customer metadata.

When the limit is exceeded, the API returns `429 Too Many Requests` with a `Retry-After` header.

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
