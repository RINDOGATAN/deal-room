# Findings: storefront alignment, cycle 8 (2026-09-15)

Each entry states what the public site says, what is true in this tree today,
and the smallest change on either side. The storefront copy is owned by another
tree and is not edited from here.

## 1. "checklists" in the Dealroom line

**The line says** (English): "Contracts negotiated and signed between people,
with checklists and signed deliverables." (Spanish: "Contratos que se negocian y
se firman entre personas, con listas de comprobación y entregables firmados.")

**What is true today:**

- Negotiated and signed between people: holds. Two-party `NEGOTIATION` mode,
  type-to-sign via `SigningRequest` (`src/server/routers/signing.ts`), covered
  by `e2e/full-lifecycle.spec.ts` ("create → walk → submit → invite →
  respondent → review → sign") and the router scoping tests in
  `src/server/routers/__tests__/deal.test.ts`.
- Signed deliverables: holds. The signed contract is produced as a PDF by
  `src/app/api/deals/[id]/document` (annexes rendered after the signature
  pages) and the TIA by `src/app/api/deals/[id]/tia`.
- Checklists: holds only partly. Nothing in the product is presented to the
  user as a checklist. The closest features are the "Ongoing obligations"
  ledger on the deal page (`src/lib/obligations.ts`, a read-only list of duties
  derived from the agreed clauses, with no tick state) and the sign-page
  warning for unfilled parameter blanks (`findUnfilledParameterTokens`). The
  only text named "checklist" is the validation checklist inside the public
  agent-preparation documentation.

**Smallest change:** on the storefront, replace "checklists" with "an
obligations list" ("una lista de obligaciones" in Spanish); or, in this tree,
give the obligations ledger a per-item done state and rename the card to
"Obligations checklist". The first is a copy change; the second is a small
feature.

## 2. "arbitration by Gavel" in the Dealroom for agents line

**Resolved on the tree side (cycle 9, 2026-09-15, branch `gavel/honest-refusal`).**
The dispute route now refuses with `503 { "error": "gavel_not_configured" }`
and stores nothing when `GAVEL_API_KEY` or `GAVEL_API_URL` is missing or empty;
the placeholder case is gone. `src/app/api/__tests__/agent-dispute-route.test.ts`
asserts the outbound case payload with the key set (mocked fetch) and the 503
refusal without it. The public documentation (`/docs/agent-api`, section
"Disputes", and `docs/agent-api.md`) states the 503 and its meaning. Still open
on the owner's side: whether the key is set on the hosted deployment, which
decides whether the storefront line can say "arbitration by Gavel" without
qualification. The original entry follows for the record.

**The line says**: "Agents closing deals with each other under rules you set,
with arbitration by Gavel when they disagree." The button links to
`/docs/agent-api` on the product domain.

**What is true today:**

- The documentation route exists: `src/app/(public)/docs/agent-api/page.tsx`
  (section "Disputes", endpoint `POST /deals/:id/dispute`, scope
  `disputes:create`), served under the public docs layout.
- The hand-off is implemented in
  `src/app/api/v1/agent/deals/[id]/dispute/route.ts`: it opens a case at
  `GAVEL_API_URL/cases` with `GAVEL_API_KEY`, stores an `AgentDispute` row,
  and the inbound webhook at `src/app/api/webhooks/gavel/route.ts` fails
  closed without `GAVEL_WEBHOOK_SECRET`.
- Two gaps. First, when `GAVEL_API_KEY` is unset the route still answers 201
  and stores a `placeholder_<timestamp>` case id, so a caller cannot tell that
  no arbitration was opened. Second, neither the dispute route nor the webhook
  has an automated test; the only gate is the `features.agentApi` flag, which
  is a constant `true`, and whether the Gavel key is set on the hosted build
  cannot be verified from this tree.

**Smallest change:** in this tree, return 503 "Gavel not configured" instead
of the placeholder when the key is missing, and add a route test that asserts
the outbound case payload and the placeholder refusal. Until then the
storefront line should read "with arbitration by Gavel when it is enabled"
or the owner should confirm `GAVEL_API_KEY` is set on the hosted deployment.
