# Dealroom Demo Video Script

**Scenario:** Two startups negotiate a SaaS Agreement. A lawyer reviews the deal before signing.

**Characters:**
- **Alice Johnson** (alice@demo.todo.law) — CEO of Acme Corp, the SaaS provider
- **Bob Smith** (bob@demo.todo.law) — CTO of Widget Inc, the customer
- **Lawyer** — Reviews the negotiated terms before signing

**Contract:** SaaS Agreement · California · English

**Duration target:** 4–5 minutes

---

## PRE-REQUISITES

Before recording, ensure:
1. Dev server running (`npm run dev`)
2. Demo deals cleared (`npm run deal:simulate -- --clean`)
3. Both demo accounts exist (alice@demo.todo.law, bob@demo.todo.law)
4. Browser zoom ~110% for legibility on video
5. Two browser windows side-by-side (Alice left, Bob right)

---

## ACT 1 — CREATE THE DEAL (Alice, ~45s)

### Scene 1.1 — Landing & Sign In
- Open `dealroom.todo.law` → landing page with hero video
- Click **Get Started** → sign-in page
- Enter `alice@demo.todo.law` → click magic link flow
- Arrives at `/deals` — empty state with "New Deal" button

### Scene 1.2 — Select Template
- Click **New Deal**
- Browse contract grid — point out jurisdiction badges and bilingual labels
- **Filter:** click "California" pill to narrow results
- Click **SaaS Agreement** card
- *Callout:* "Each contract is a lawyer-authored skill — bilingual, jurisdiction-aware"

### Scene 1.3 — Configure Deal
- **Deal name:** "Acme × Widget SaaS"
- **Jurisdiction:** California (pre-selected from filter)
- **Language:** English
- **Mode:** Two-Party Negotiation (default)
- Click **Create Deal** → lands on deal overview (`/deals/[id]`)

### Scene 1.4 — Invite Counterparty
- Deal overview shows empty progress bars, one party card
- Click **Invite counterparty**
- Fill: `bob@demo.todo.law`, "Bob Smith", "Widget Inc"
- Click **Send Invitation**
- *Callout:* "Bob gets an email. While we wait, Alice makes her selections."

---

## ACT 2 — ALICE NEGOTIATES (Alice, ~60s)

### Scene 2.1 — Enter Negotiation
- Click **Make Selections** → negotiation interface
- Point out the sidebar with all 10 clauses grouped by category
- Point out progress bar at top (0/10)

### Scene 2.2 — Walk Key Clauses (show 3–4 in detail, skip through others)

**Clause 1: Subscription Model**
- Expand first option → show pros/cons grid + full legal text preview
- Select "Per-seat subscription" option
- Set **firmness to 4/5** (drag slider) — "Alice is firm on per-seat pricing"
- Click **Next**

**Clause 3: Service Level Agreement** (skip to it via sidebar)
- Click clause in sidebar to jump
- Select "99.9% uptime with credits" option
- Set **firmness to 2/5** — "Alice is open to negotiation here"
- Click **Next**

**Clause 7: Data Portability** (click in sidebar)
- Select "Full export within 30 days"
- Set **firmness to 5/5** — "Non-negotiable for Alice"
- *Callout:* "Firmness controls how the compromise algorithm weighs each party's preference"

**Remaining clauses:** quickly click through selecting options, varying firmness
- On the **last clause**, point out the **Predicted Outcome** panel:
  - "For you: Favorable" / "For them: Balanced"
  - *Callout:* "Before submitting, you can see how the algorithm predicts the outcome"

### Scene 2.3 — Submit
- Click **Submit Selections**
- Redirected to deal overview — Alice's progress bar is full, Bob's is empty
- *Callout:* "Alice is done. Now it's Bob's turn."

---

## ACT 3 — BOB NEGOTIATES (Bob, ~45s)

### Scene 3.1 — Bob Signs In & Joins
- Switch to Bob's browser window
- Sign in as `bob@demo.todo.law`
- Deal appears in Bob's `/deals` list with "AWAITING_RESPONSE" badge
- Click into the deal → overview shows Alice has submitted

### Scene 3.2 — Bob Makes Different Choices
- Click **Make Selections**
- Notice the **pre-populate banner**: "Copy initiator's selections as starting point"
- Bob declines — wants to make his own choices

**Clause 1: Subscription Model**
- Bob selects "Usage-based pricing" (different from Alice!)
- Sets **firmness to 3/5**

**Clause 3: SLA**
- Bob selects "99.5% uptime, no credits" (different)
- Sets **firmness to 4/5** — "Bob is firmer here"

**Clause 7: Data Portability**
- Bob selects "Export within 90 days" (conflicts with Alice's non-negotiable)
- Sets **firmness to 2/5** — less firm

- Quickly complete remaining clauses with some agreements, some differences

### Scene 3.3 — Submit & Trigger Compromise
- Click **Submit Selections**
- *Callout:* "Both parties have submitted. The compromise algorithm now runs."

---

## ACT 4 — REVIEW COMPROMISES (Both, ~60s)

### Scene 4.1 — See Results (Alice's view)
- Switch to Alice's browser
- Navigate to deal → click **Review Compromises**
- **Outcome card** shows: "For you: Favorable" / "For them: Balanced"
- *Callout:* "The algorithm considered each party's firmness, biases, and preferences"

### Scene 4.2 — Walk Through Compromises

**Agreed automatically (both picked the same):**
- Show a clause where both agreed → green "AGREED" badge
- *Callout:* "When both parties pick the same option, it's auto-agreed"

**Compromised clause (e.g., SLA):**
- Show suggestion with reasoning
- *Callout:* "The algorithm chose Bob's preference here because he was firmer (4/5 vs Alice's 2/5)"
- Alice clicks **Accept**

**Divergent clause (Data Portability):**
- Alice was 5/5 firm, Bob was 2/5
- Algorithm sided with Alice (higher firmness wins)
- *Callout:* "Alice's non-negotiable position held — the algorithm respects firm stances"
- Bob accepts on his side

### Scene 4.3 — Accept All Remaining
- Click **Accept** on each remaining suggestion
- All clauses turn to "AGREED"

---

## ACT 5 — LAWYER REVIEW (Alice, ~45s)

### Scene 5.1 — Request Attorney Review
- On the review page, click **Request Attorney Review**
- Lawyer directory modal opens — browse available lawyers
- Select a lawyer with California jurisdiction
- *Callout:* "Before signing, either party can request an independent attorney review"

### Scene 5.2 — Lawyer Reviews (Lawyer's view)
- Show lawyer's view at `/lawyers/requests`
- Lawyer sees the deal with all agreed terms
- Reviews clause-by-clause
- Approves with optional notes
- *Callout:* "The lawyer can review every negotiated term and the compromise reasoning"

### Scene 5.3 — Review Complete
- Back to Alice's view — review status shows "Attorney review complete"
- Click **Proceed to Signing**

---

## ACT 6 — SIGN & COMPLETE (Both, ~45s)

### Scene 6.1 — Alice Signs
- Signing page shows execution details form
- Fill in:
  - Legal name: "Acme Corp, Inc."
  - Address: "100 Market St, San Francisco, CA 94105"
  - Signatory: "Alice Johnson, CEO"
- Type signature in the type-to-sign field
- Check confirmation box
- Click **Sign**
- *Callout:* "Type-to-sign — your typed name is your legal electronic signature."

### Scene 6.2 — Bob Signs
- Switch to Bob's browser
- Same signing flow — fill details, type signature, sign

### Scene 6.3 — Deal Complete
- Deal status changes to **COMPLETED**
- Download the final PDF
- Open PDF — show the professional contract with:
  - Preamble with both party details
  - Definitions section
  - Standard clauses (boilerplate)
  - Negotiated terms (the clauses they debated)
  - General provisions
  - Jurisdiction-specific provisions (California)
  - Signature blocks
- *Callout:* "A complete, jurisdiction-specific contract — negotiated in minutes, not weeks"

---

## CLOSING (~15s)

- Return to deal overview showing COMPLETED status with green badge
- *Callout:* "Dealroom — lawyer-authored contracts, algorithmically negotiated, legally signed. Available in English and Spanish across three jurisdictions."

---

## KEY MOMENTS TO HIGHLIGHT

| Timestamp | Feature | What to show |
|-----------|---------|-------------|
| Act 2.2 | Firmness slider | Drag between 1–5, explain impact |
| Act 2.2 | Legal text preview | Expand option to show full clause text |
| Act 2.2 | Predicted outcome | Satisfaction predictions before submit |
| Act 4.2 | Compromise reasoning | Algorithm explanation per clause |
| Act 4.2 | Firmness wins | Higher firmness = stronger weight |
| Act 5 | Attorney review | Lawyer involvement before signing |
| Act 6.3 | Generated PDF | Professional multi-page contract |

## OPTIONAL BONUS SCENES

**Bilingual:** Repeat Act 1.2 but select "Español" — show the same contract entirely in Spanish.

**Agent API:** Show a terminal running `curl` commands against the Agent API — two AI agents negotiate the same SaaS agreement in seconds via REST.

**Marketplace:** Browse `/marketplace`, show premium skills with pricing, explain the open-core model.

**Counter-proposals:** Instead of accepting a compromise in Act 4, Alice rejects and submits a counter-proposal. Bob sees it and responds. Show multi-round negotiation.
