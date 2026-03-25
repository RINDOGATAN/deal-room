# Agent-to-Agent Contract Skills

Dealroom provides a suite of 12 contract skills designed for autonomous AI agent interactions. These skills function as a **legal middleware layer** — enabling agents to negotiate binding terms before transacting, instead of blindly accepting unilateral Terms of Service.

---

## Why A2A Contracts?

When AI agents interact with each other or with services, legal gaps emerge:

- **Terms of Service are imposed unilaterally** and may contain abusive or unenforceable clauses
- **Obligations cascade** down to the agent's owner/organization with no negotiation
- **Error handling** is absent when terms are legally problematic
- **Dispute resolution** defaults to expensive, slow court proceedings or is simply undefined

Dealroom's A2A skills let both parties' agents negotiate terms that reflect their organizations' risk tolerance, data policies, and operational requirements — using the same weighted compromise algorithm that powers human contract negotiation.

---

## Skill Catalog

All A2A skills are:
- Fully bilingual (English / Castilian Spanish)
- Available for 3 jurisdictions (California, England & Wales, Spain)
- Bundled under the A2A subscription (not sold individually)
- Equipped with Gavel automated arbitration as the default dispute resolution option

| Skill | Contract Type | Clauses | Party A | Party B | Use Case |
|-------|--------------|---------|---------|---------|----------|
| API Access | `A2A_API_ACCESS` | 8 | API Provider | API Consumer | Agent consuming third-party APIs — rate limits, SLAs, data handling, IP |
| Tool License | `A2A_TOOL_LICENSE` | 7 | Tool Provider | Licensee | Agent tool/skill/plugin licensing — usage scope, output liability, maintenance |
| Data Sharing | `A2A_DATA_SHARING` | 8 | Data Provider | Data Recipient | Inter-agent data exchange — privacy, retention, cross-border transfer, GDPR |
| Compute Procurement | `A2A_COMPUTE_PROCUREMENT` | 7 | Compute Provider | Consumer | Agent procurement of cloud/GPU/storage — pricing, capacity, data sovereignty |
| Task Delegation | `A2A_TASK_DELEGATION` | 7 | Principal | Subcontractor | Agent sub-contracting tasks — performance, quality, cascading liability |
| Content License | `A2A_CONTENT_LICENSE` | 7 | Licensor | Licensee | AI-generated content licensing — copyright, derivatives, attribution |
| Marketplace | `A2A_MARKETPLACE` | 7 | Operator | Participant | Agent marketplace transactions — fees, buyer protections, refunds |
| Orchestration | `A2A_ORCHESTRATION` | 7 | Orchestrator | Participant | Multi-agent coordination — liability allocation, error handling, governance |
| Payment Authorization | `A2A_PAYMENT_AUTHORIZATION` | 7 | Payment Provider | Payer | Agent financial transactions — spending limits, fraud liability, settlement |
| Knowledge Access | `A2A_KNOWLEDGE_ACCESS` | 7 | Knowledge Provider | Consumer | RAG / knowledge base access — caching, training exclusion, accuracy |
| Supply Chain | `A2A_SUPPLY_CHAIN` | 7 | Coordinator | Partner | Cross-org agent collaboration — order management, delivery SLAs, compliance |
| Monitoring | `A2A_MONITORING` | 7 | Principal | Monitor | Agent observability and audit — scope, reporting, alerting, compliance certification |

**Totals:** 12 skills, 86 negotiable clauses, 258 option variants.

---

## Key Negotiable Themes

The following themes recur across A2A skills. Each is represented as a clause with 3 options ranging from provider-favorable to consumer-favorable:

| Theme | Example Clause | Appears In |
|-------|---------------|------------|
| **Liability caps** | Unlimited / fixed cap / 12 months' fees | API Access, Orchestration, Tool License |
| **Data handling** | Delete / anonymize / retain under license | API Access, Data Sharing, Knowledge Access |
| **SLA commitments** | Best effort / 99% / 99.9% uptime | API Access, Compute, Supply Chain |
| **IP ownership** | Consumer owns / shared / provider owns | API Access, Content License, Task Delegation |
| **Indemnification** | Mutual / one-way / none | API Access, Tool License, Orchestration |
| **Termination** | 30-day convenience / for cause / immediate | API Access, Compute, Marketplace |
| **Audit rights** | Full access / third-party audit / self-cert | Data Sharing, Monitoring, Supply Chain |
| **Dispute resolution** | Gavel / traditional arbitration / courts | All 12 skills |

---

## Gavel Dispute Resolution

Every A2A skill includes a **dispute-resolution** clause with three options:

### 1. Gavel Automated Arbitration (Default)

Digital arbitration via [gavel.todo.law](https://gavel.todo.law). Designed for agent-speed commerce:

- **Electronic proceedings** — each party submits position and evidence through the Gavel platform
- **Binding decisions** — the arbitral award is final and enforceable
- **Escrow mechanism** — disputed amounts can be held in escrow during proceedings
- **Fast turnaround** — days, not months

This is the first option (order 1) in every skill, with neutral bias (0/0), making it the recommended default for A2A negotiations.

### 2. Traditional Arbitration

Jurisdiction-dependent institutional arbitration:
- **California:** JAMS Comprehensive Arbitration Rules
- **England & Wales:** LCIA Arbitration Rules
- **Spain:** ICC Arbitration Rules

### 3. Court Jurisdiction

Fallback to courts in the governing law jurisdiction.

### Dispute Escalation via API

When parties agree to Gavel arbitration, disputes can be escalated programmatically:

```
POST /api/v1/agent/deals/:id/dispute
Scope: disputes:create

{
  "reason": "Counterparty breached SLA clause",
  "escrowAmount": 50000
}
```

See [agent-api.md](./agent-api.md) for full endpoint documentation.

---

## Subscription Model

A2A skills are sold as a bundle, not individually.

| Tier | Price | Invocations | Detection |
|------|-------|-------------|-----------|
| **Standard** | €9 / $9 per month | 5 per skill per week | Default for all A2A subscribers |
| **Premium** | €60 / $60 per month | 300 total per week | `premiumA2A` flag in customer metadata |

**Rate limit enforcement:**
- Applied at the negotiate endpoint for contract types with the `A2A_` prefix
- Standard tier tracks per `customerId + contractType` (5/week each)
- Premium tier tracks per `customerId` aggregate (300/week total)
- Exceeding limits returns `429 Too Many Requests` with `Retry-After` header

**Rate limit response:**
```json
{
  "error": "A2A contract invocation limit reached (5 per skill/week). Upgrade to premium tier for 300 calls/week.",
  "remaining": 0
}
```

---

## Negotiation Flow

A2A contracts follow the same flow as all Dealroom negotiations:

```
Agent A                                    Agent B
  │                                          │
  │  1. GET /templates                       │
  │     (discover A2A contract types)        │
  │                                          │
  │  2. POST /playbooks                      │
  │     (set clause preferences + red lines) │
  │                                          │
  │  3. POST /negotiate                      │
  │     → negotiationToken                   │
  │                                          │
  │  4. Send token ──────────────────────────│
  │                                          │
  │                           5. POST /playbooks
  │                              (own preferences)
  │                                          │
  │                           6. POST /negotiate/join
  │                              {token + playbookId}
  │                                          │
  │     ┌──────────────────────────────┐     │
  │     │  Compromise engine resolves: │     │
  │     │  red lines → stake calc →    │     │
  │     │  weighted compromise → agree │     │
  │     └──────────────────────────────┘     │
  │                                          │
  │  7. GET /deals/:id                       │
  │     (agreed terms + satisfaction scores) │
  │                                          │
  │  8. GET /deals/:id/document              │
  │     (download PDF / DOCX)               │
```

The compromise algorithm uses the standard formula:

```
stake = ((5 - flexibility) / 5 × 0.6) + (|bias| × 0.4)
```

The party with the higher stake on a clause gets more weight in the compromise. See [agent-api.md](./agent-api.md) for the complete API reference.

---

## Example: Two Agents Negotiate API Access Terms

**Scenario:** Agent A (an AI assistant) needs to consume Agent B's data enrichment API. Both organizations want formal terms.

### Step 1: Agent A creates a playbook

```json
{
  "name": "API Consumer - Conservative",
  "contractType": "A2A_API_ACCESS",
  "governingLaw": "CALIFORNIA",
  "contractLanguage": "en",
  "entries": [
    {
      "clauseId": "uptime-sla",
      "preferredOptionId": "SLA_999",
      "flexibility": 2,
      "isRedLine": false
    },
    {
      "clauseId": "data-handling",
      "preferredOptionId": "DELETE_ON_TERMINATION",
      "flexibility": 1,
      "isRedLine": true,
      "acceptableOptions": ["DELETE_ON_TERMINATION", "ANONYMIZE_ON_TERMINATION"]
    },
    {
      "clauseId": "liability-cap",
      "preferredOptionId": "LIABILITY_12M_FEES",
      "flexibility": 3,
      "isRedLine": false
    },
    {
      "clauseId": "dispute-resolution",
      "preferredOptionId": "GAVEL_ARBITRATION",
      "flexibility": 4,
      "isRedLine": false
    }
  ]
}
```

### Step 2: Agent B creates a playbook

```json
{
  "name": "API Provider - Standard Terms",
  "contractType": "A2A_API_ACCESS",
  "governingLaw": "CALIFORNIA",
  "contractLanguage": "en",
  "entries": [
    {
      "clauseId": "uptime-sla",
      "preferredOptionId": "SLA_99",
      "flexibility": 2,
      "isRedLine": false
    },
    {
      "clauseId": "data-handling",
      "preferredOptionId": "ANONYMIZE_ON_TERMINATION",
      "flexibility": 3,
      "isRedLine": false
    },
    {
      "clauseId": "liability-cap",
      "preferredOptionId": "LIABILITY_FIXED",
      "flexibility": 2,
      "isRedLine": false
    },
    {
      "clauseId": "dispute-resolution",
      "preferredOptionId": "GAVEL_ARBITRATION",
      "flexibility": 5,
      "isRedLine": false
    }
  ]
}
```

### Step 3: Compromise result

| Clause | Agent A Wanted | Agent B Wanted | Agreed | Reasoning |
|--------|---------------|---------------|--------|-----------|
| Uptime SLA | 99.9% | 99% | 99.9% | Equal flexibility but Agent A's option has lower bias, indicating stronger need |
| Data Handling | Delete all | Anonymize | Anonymize | Agent A's red line accepts both; Agent B's higher flexibility yields to anonymize as mutual ground |
| Liability Cap | 12 months' fees | Fixed $100K | 12 months' fees | Agent A has lower flexibility (higher stake), so compromise favors their position |
| Dispute Resolution | Gavel | Gavel | Gavel | Both agree — no compromise needed |

Both agents receive the agreed contract as a PDF with jurisdiction-specific provisions for California.

---

## Technical Implementation

### Seeding

A2A skills live in the private `RINDOGATAN/legalskills` repository and are seeded to production via the same pipeline as other premium skills:

```bash
# Seed all skills (built-in + premium + A2A)
DATABASE_URL="<unpooled URL>" SKILLS_DIR=/path/to/legalskills npx prisma db seed
```

All 12 A2A skill IDs are registered in `prisma/seed.ts` and marked as premium with the standard €9/month Stripe price.

### Rate Limiting

A2A rate limits are implemented in `src/server/middleware/apiKeyAuth.ts`:

- `checkA2aRateLimit(customerId, contractType, isPremiumA2a)` — sliding window over 1 week
- Standard tier: per-skill tracking (`customerId:a2a:A2A_API_ACCESS`)
- Premium tier: aggregate tracking (`customerId:a2a:premium`)
- Enforced in `src/app/api/v1/agent/negotiate/route.ts` for any `contractType.startsWith("A2A_")`

### Database

The `Customer.metadata` JSON field stores tier configuration:

```json
{
  "premiumA2A": true
}
```

This is set via the admin panel. Migration: `20260324000000_add_customer_metadata`.

### Discovery

A2A contract types appear automatically in:
- `GET /.well-known/agent.json` — A2A protocol discovery card (supportedContractTypes)
- `GET /api/v1/agent/templates` — filtered by customer entitlements
- `GET /api/v1/agent/mcp` — MCP tool definitions

---

## Skill Structure Reference

Each A2A skill consists of 4 files:

| File | Purpose |
|------|---------|
| `metadata.json` | Contract type, display name, description, jurisdictions, languages, solo mode flags |
| `clauses.json` | Negotiable clauses with options, bias values, bilingual legal text |
| `boilerplate.json` | Preamble, definitions, standard clauses, jurisdiction provisions, signature block |
| `manifest.json` | Licensing metadata — skill ID, version, author |

### Clause Option Structure

Every option in every clause includes:

```
id, code, label (EN/ES), order,
plainDescription (EN/ES),
prosPartyA (EN/ES), consPartyA (EN/ES),
prosPartyB (EN/ES), consPartyB (EN/ES),
legalText (EN/ES),
biasPartyA, biasPartyB
```

Bias values are balanced: if `biasPartyA = 0.3`, then `biasPartyB = -0.3`. The Gavel dispute resolution option always has bias `0/0` (neutral).

### Boilerplate Structure

Each boilerplate includes:
- **Preamble** with `{partyAName}`, `{partyBName}`, `{effectiveDate}`, `{partyAAddress}`, `{partyBAddress}` variables
- **Definitions** (5-6 domain-specific terms)
- **Standard clauses** (4-5 non-negotiable provisions like acceptable use, security, confidentiality)
- **General provisions** (5-6: entire agreement, amendments, severability, assignment, force majeure, counterparts)
- **Jurisdiction provisions** for California, England & Wales, and Spain — with real statutory references
- **Signature block** and **party labels** (bilingual)

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [agent-api.md](./agent-api.md) | Full Agent API reference including A2A subscription and rate limit documentation |
| [skills-and-licensing.md](./skills-and-licensing.md) | Skill packaging, licensing model, activation flow |
| [administration.md](./administration.md) | Admin panel, skill catalog, deal lifecycle |
| [a2a-research.md](./a2a-research.md) | Research: 25 A2A scenarios, dispute resolution trends, gap analysis |
