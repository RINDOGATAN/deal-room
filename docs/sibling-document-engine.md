# Sibling-Document Engine (design)

Closes the remaining B-4/B-7 items from the 2026-08-08 law-firm QA pass:
when one account holds several related agreements (MSA + DPA + BAA + NDA),
Dealroom should know they are related, keep their shared facts aligned, and
surface every deliberate-or-accidental divergence before signing.

The document-side halves already shipped in v0.1.24: defined and
cross-referenced terminology (DPA "Principal Agreement" ↔ BAA "Underlying
Agreement") and mirrored precedence carve-outs. What remains is the engine:
detection, linking, prefill, and the consistency report.

## Design principles

1. **Explicit link beats inference.** The user states the relationship; the
   engine only *suggests* candidates. No silent guessing in legal documents.
2. **Advisory, never blocking.** Cross-document deltas can be intentional
   (a DPA with a stricter breach window than the MSA is a valid choice).
   Unlike the TIA self-contradictions (which block because a single document
   contradicts itself), sibling deltas render as a report the user confirms,
   in the same visual pattern as the sign-page blank warning.
3. **Rules read structured state, not text.** Deals already store agreed
   option codes and parameters. Rules compare those — never regexes over
   legal prose — so they are pure functions, unit-testable, and immune to
   copy edits.
4. **Additive schema.** One new table; migrations append-only as always.

## Data model

```prisma
model DealRelation {
  id            String   @id @default(cuid())
  dealRoomId    String   // the document declaring the relation (e.g. the DPA)
  relatedDealId String   // the document it points at (e.g. the MSA)
  relation      DealRelationType
  createdById   String   // user who asserted the link
  createdAt     DateTime @default(now())

  dealRoom    DealRoom @relation("outgoingRelations", fields: [dealRoomId], references: [id], onDelete: Cascade)
  relatedDeal DealRoom @relation("incomingRelations", fields: [relatedDealId], references: [id], onDelete: Cascade)

  @@unique([dealRoomId, relatedDealId])
  @@map("deal_relations")
}

enum DealRelationType {
  SUPPLEMENTS   // this deal forms part of / supplements the related one (DPA → MSA)
  COEXISTS_WITH // parallel agreements over overlapping subject matter (DPA ↔ BAA)
}
```

Directionality matters for SUPPLEMENTS (the DPA supplements the MSA, not
vice versa); COEXISTS_WITH is symmetric and stored once in either direction.

## Sibling candidate inference

`suggestSiblings(userId, counterpartyHints)` returns recent deals of the
same initiator whose counterparty matches, ranked:

1. **Party email match** (exact, case-insensitive) — strongest signal.
2. **Legal-name match**: `signingDetails.legalName` or `company`,
   normalized (case, punctuation, and a corporate-suffix strip list:
   Inc/LLC/Ltd/GmbH/S.L./S.A./B.V./SARL…).
3. Same-initiator-only fallback (shown under "other deals", unranked) —
   solo deals often carry no counterparty identity until signing.

Only non-CANCELLED deals; newest first; capped at ~8. Pure helper in
`src/lib/sibling-match.ts` with unit tests over the normalizer.

## Wizard integration (link + prefill)

In the deal-details step, when `suggestSiblings` returns candidates (or
always, behind a collapsed "Link to an existing deal" disclosure):

> **Is this agreement related to one of your existing deals?**
> ○ MSA — Acme Corp (signed 2026-07-02) → *this deal supplements it*
> ○ BAA — Acme Corp (draft) → *coexisting agreement*
> ○ Not related

Choosing a sibling:

- stores the `DealRelation` at creation (tRPC `deal.create` gains an
  optional `relatedDeal: { id, relation }` input);
- **prefills** from the sibling: counterparty invite email/company (two-party
  mode), `custom-governing-law` / `custom-courts` when the sibling agreed a
  custom-law option, and the breach-window default (see rules below) —
  each prefill visibly editable, never silent;
- derives the **concrete Principal Agreement reference**: a new
  auto-populated parameter `principal-agreement-reference` ("the Master
  Services Agreement between the parties dated 2 July 2026") consumed by
  the DPA's Principal Agreement definition and preamble. The generator
  falls back to today's generic wording when no link exists. Same
  mechanism feeds the BAA's Underlying Agreement definition.

## Consistency rules registry

`src/lib/sibling-rules.ts` — a declarative list evaluated against the pair
of deals' agreed option codes and parameters:

```ts
interface SiblingRule {
  id: string;                       // "breach-window", "law-forum", ...
  appliesTo(a: ContractType, b: ContractType, rel: DealRelationType): boolean;
  evaluate(a: DealSnapshot, b: DealSnapshot): SiblingDelta | null;
}
interface SiblingDelta {
  ruleId: string;
  severity: "warning" | "info";
  summaryKey: string;               // i18n key; values interpolated
  values: Record<string, string>;   // e.g. { thisWindow: "24h", siblingWindow: "72h" }
}
```

`DealSnapshot` is a thin projection (contract type, governing-law key,
agreed option code per clauseId, parameters) built server-side.

**v1 rules (each ~30 lines + tests):**

| Rule | Reads | Fires when |
|---|---|---|
| `law-forum` | agreed governing-law/dispute option code + custom-law params | The two documents resolve to different governing law or forum (including custom vs jurisdiction-derived). |
| `breach-window` (B-7) | breach/incident-notification option codes, mapped to hours | The supplement's window differs from the sibling's — either direction, since both "stricter" and "looser" deserve a conscious keep. |
| `liability-cap` | DPA `breach-liability-cap` option vs MSA/SaaS liability option | The DPA carries a standalone cap while the linked principal caps liability differently (or vice versa) — reports both structures side by side. |
| `phi-carveout` | contract-type pair + precedence provisions | A DPA and BAA coexist for the same counterparty: confirms both carry the mirrored carve-outs (info-level; they do by default since v0.1.24 — the rule exists to catch counterparty-edited or pre-v0.1.24 documents). |

Cross-type clause identification: v1 hardcodes the clauseId pairs inside
each rule (`breach-notification` ↔ `breach-notification` across dpa/msa/
saas is already uniform in the built-in skills). If premium skills diverge,
promote the pairs into `ClauseMapping` rows with a new `mappingType:
"sibling"` — the table and its family-key pattern already exist.

## Surfacing

- **tRPC `deal.getSiblingReport({ dealRoomId })`** → `{ siblings, deltas }`.
  Access rule: only siblings **the requesting user is a party to** are
  evaluated and named; a linked deal the viewer cannot access is omitted
  entirely (no redacted stubs leaking that other business exists).
- **Review page + sign page**: a "Cross-document check" card in the
  established warning-card style, one row per delta with the two values
  side by side and a link to the sibling deal. Advisory only; the existing
  confirm-to-sign flow is untouched.
- **Deal page header**: a small "supplements MSA — Acme Corp" chip for
  navigation between linked documents.

## Two-party semantics

Both parties see the report for deals they can access (rule above). Deltas
are computed on **agreed** state only — mid-negotiation proposals don't
fire rules, avoiding noise while options are still moving.

## Phasing

1. **Phase 1 — link + reference (schema, wizard, generator).** DealRelation
   migration, wizard selector + prefills, `principal-agreement-reference`
   derivation, chips on the deal page. No rules yet. *(the biggest UX win:
   counterparty prefill + concrete references)*
2. **Phase 2 — rules + report.** Registry with the four v1 rules,
   `getSiblingReport`, review/sign card, EN/ES messages, unit tests per
   rule + one e2e (create MSA → link DPA with different window → card
   shows delta).
3. **Phase 3 — inference polish.** Candidate ranking from signing
   history, `ClauseMapping`-driven pairs for premium skills, A-6's layout
   pass can ride this release.

Out of scope (deliberately): cross-app siblings (DPO Central RoPA links),
free-text/NLP comparison of clause prose, auto-editing either document to
"fix" a delta, and any blocking behavior.

## Test plan

- Unit: normalizer (suffix strip, accents), each rule's fire/no-fire
  matrix, snapshot builder, report access filtering.
- e2e: link-at-creation flow incl. prefill visibility; report card on sign
  page; solo-mode link (no counterparty) still renders the concrete
  Principal Agreement reference.
- Golden generation: linked DPA renders "the Master Services Agreement
  between the parties dated …" in the definition; unlinked keeps the
  generic fallback byte-identical to v0.1.24 output.
