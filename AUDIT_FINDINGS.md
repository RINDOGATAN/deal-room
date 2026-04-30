# Journey Matrix Audit — Findings

**Date:** 2026-04-28
**Scope:** Layer 1 — Journey matrix (read-only static audit)
**Status:** Layer 1 complete. Layers 2 (mobile) and 3 (value-prop / skill content) deferred per agreement.

Severity: **[H]** ship-blocker, security, data loss · **[M]** real bug, single-change fix · **[L]** polish.

---

## Baseline (static checks — all green)

- `npm run test:run` — 25/25 vitest passing
- `npm run check:api` — 49 routes clean (no raw error leaks)
- `npx tsc --noEmit` — clean (after fixing one E2E spec — `e2e/visual.spec.ts` `webkitBackdropFilter` cast, edited in this session)
- `npm run lint` — 242 pre-existing problems, mostly `no-explicit-any` and unused vars. **Out of scope** for this audit.

---

## Ship-blockers (must fix before any "everything works" claim)

### [H] Gavel webhook fails open if secret missing — `src/app/api/webhooks/gavel/route.ts:33-40`

```ts
if (GAVEL_WEBHOOK_SECRET) {
  if (!verifyGavelSignature(body, signature)) { ... 400 ... }
}
```

If `GAVEL_WEBHOOK_SECRET` env var is unset (any misconfigured environment), **any anonymous POST** can mark disputes RESOLVED, alter resolution data, or fake escrow releases. This is the highest-stakes external surface in the agent platform.

**Fix shape:** Fail closed. If `!GAVEL_WEBHOOK_SECRET`, refuse to start (server-side), or refuse the request (return 503 + log loudly). Never accept unsigned payloads.

### [H] Signing journey advertises DocuSign + HelloSign but only type-to-sign actually works — `src/server/routers/signing.ts:218,247`

`signing.ts:218` is a literal `// 2. Send to DocuSign/HelloSign API` comment, not an implementation. `signing.ts:247` hardcodes `provider: "type-to-sign"` for every initiated signing request. CLAUDE.md, the docs, and the public marketing all promise three providers. Today only one is reachable.

**Fix shape:** Two paths — (a) implement at least one external provider end-to-end (DocuSign is the obvious choice), or (b) remove DocuSign/HelloSign mentions from CLAUDE.md, public docs, and `cloud-services` admin page until shipped. Don't leave the value prop dangling.

### [H] Total founder equity not validated on /launch — `src/app/(dashboard)/launch/new/page.tsx:40-43,69-72`

`totalEquity` is computed and shown but `foundersStepValid` only checks name + email. A user can submit `30 + 30 = 60%` (or `60 + 60 = 120%`) and the journey proceeds. Cap-table-bearing documents downstream will inherit the broken split.

**Fix shape:** Tighten `foundersStepValid` to require `Math.abs(totalEquity - 100) < 0.1` when any equity is provided, surface a sum-mismatch error.

### ~~[H] Invitation token replay / duplicate-email creation~~ — **FALSE POSITIVE (verified 2026-04-28)**

Agent's claim was that a separate "creation path" lacked dedup. On verification: `prisma.invitation.create` is called from exactly one place (`invitation.send`), which already (a) errors out if a RESPONDENT party already exists (line 59-67), preventing a second send to the same deal, and (b) cancels prior PENDING invitations as belt-and-braces (line 70-80). No duplicate-PENDING-invitations bug exists.

**Related (smaller) issue worth noting [L]:** Two concurrent `send` calls for the same deal could each pass the "no existing respondent" check and create duplicate `DealRoomParty` rows. No DB unique constraint on `(dealRoomId, role)` for RESPONDENT. Vanishingly rare in practice; out of scope for this fix pass.

---

## Real bugs (single-change fixes)

### [M] Race on AGREED→SIGNING transition — `src/server/routers/signing.ts:390`, `src/server/routers/compromise.ts:229`

If both parties click "Initiate Signing" simultaneously on review, both mutations can find AGREED state and create duplicate signing requests.
**Fix shape:** Conditional Prisma update with `where: { status: "AGREED", signingRequest: null }` so only one writer wins.

### [M] AWAITING_RESPONSE state has no resend-invitation surface — `src/app/(dashboard)/deals/[id]/page.tsx:168-169`

Initiator viewing a deal in AWAITING_RESPONSE has no UI to resend an invite if the email got lost. (Memory says `44f48af` shipped "stale-invitation re-engagement" — confirm this is wired here, or surface it.)
**Fix shape:** Render a "Resend invitation" action when `status === "AWAITING_RESPONSE"` and current user is initiator.

### [M] SIGNING state is unhandled in negotiate page — `src/app/(dashboard)/deals/[id]/negotiate/page.tsx:169`

`canNegotiate` excludes SIGNING but the page doesn't redirect — users can land there and see stale UI.
**Fix shape:** `if (deal.status === "SIGNING") router.replace(...)` before render.

### [M] Half-signed state stalls forever — `src/server/routers/signing.ts:94-104,436-455`

Party A signs, Party B never does → deal sits in SIGNING permanently. No `expiresAt` on `SigningRequest`, no warning. (Memory's "signing-stall warning" was on the roadmap, not shipped.)
**Fix shape:** Add `expiresAt` to `SigningRequest` (e.g. 14 days), surface a warning banner + reminder email at day 3.

### [M] Post-sign immutability not enforced at server — `src/server/routers/signing.ts:404-408`

When deal hits COMPLETED, the only thing stopping further mutations is UI guards. No central guard rejects mutations on COMPLETED deals.
**Fix shape:** Add a `requireMutableDeal()` helper rejecting COMPLETED + CANCELLED, call from every mutating procedure.

### [M] Stripe webhook idempotency — `src/app/api/webhooks/stripe/route.ts:139,273`

Webhook handlers `upsert` so corruption is bounded, but rapid Stripe redeliveries can race and produce duplicate audit-log events. Worse on multi-instance deployments.
**Fix shape:** Track `event.id` in a `StripeWebhookEvent` table with a unique constraint; ignore re-deliveries.

### ~~[M] `/api/billing/portal` resolves customer by session email only~~ — **NOT APPLICABLE (verified 2026-04-29)**

Audit's fix shape assumed `Customer.userId` exists. It doesn't. The Customer table has `email @unique` and no direct relationship to `User`. Ownership is already enforced by the chain: NextAuth verifies the email at sign-in → session carries that email → `Customer.findFirst({ where: { email } })` resolves by unique email. There is no spoofing window short of full account takeover, which compromises everything else too.

A real improvement here would be a schema change adding `Customer.userId` and backfilling — but that's beyond an [M] fix and out of scope.

### [M] API key compare is not constant-time — `src/server/middleware/apiKeyAuth.ts:30-35`

SHA256 hash is used as a Prisma `findUnique` key. Timing channel is small (DB index lookup) but tightening costs nothing.
**Fix shape:** Hash + `findUnique` is OK in practice; alternative is `findMany` over candidates with `crypto.timingSafeEqual`. Lower priority than the others on this list.

### [M] Vetting requests have no expiry — `src/server/routers/lawyer.ts:577-648`

PENDING → ACCEPTED with no timeout. Lawyer accepts then ghosts → request lives forever, requester can't cancel.
**Fix shape:** Add `expiresAt`, auto-expire after N days, expose cancel action.

### [M] Spam window: per-customer rate limit on Experts API contact, not per-expert — `src/server/middleware/apiKeyAuth.ts:107-119`

A single Customer can spread 5 contact requests across 5 different contract types and hit the same lawyer 5 times in a week.
**Fix shape:** Add a per-(customer, expert) daily cap (e.g. 2/day) on top of the existing weekly counter.

### [M] A2A rate limit window is not atomic — `src/server/middleware/apiKeyAuth.ts:107-140`

Two concurrent requests can both observe `length === 299`, both push, both pass. Premium-A2A customers (300/week) are most exposed.
**Fix shape:** Move enforcement to a DB-backed atomic increment, or wrap the in-memory window in `async-lock` per-customer.

### [M] Counter route missing rate limit — `src/app/api/v1/agent/deals/[id]/counter/route.ts:18-39`

`negotiate` and `negotiate/join` enforce limits; `counter` does not. An agent can spam unlimited counter-rounds.
**Fix shape:** Add `checkRateLimit(auth.customer.id, "negotiate")` to the counter handler.

### [M] No idempotency keys on POST endpoints — agent platform

Agents retrying on transient failures will create duplicate deals/playbooks/etc.
**Fix shape:** Honor an optional `Idempotency-Key` header, store in DB, dedupe within a 24h window. Document it on the agent.json card.

### [M] Dispute creation does not transition deal status — `src/app/api/v1/agent/deals/[id]/dispute/route.ts:163-170`

A new `AgentDispute` row is created but `AgentDealRoom.status` is unchanged. Counter/accept/reject routes do not check for disputes either, so an agent can keep negotiating a deal that's at Gavel.
**Fix shape:** Add a `DISPUTED` state to `AgentDealStatus`, transition on dispute creation, gate counter/accept/reject on `dispute === null`.

### [M] Hardcoded English in invitation pages — `src/app/invite/[token]/page.tsx` (7 strings), `src/app/client-invite/[token]/page.tsx:71`

Headings, badges, and CTAs are not running through `useTranslations()`. Spanish recipients see English on the most critical first-impression page.
**Fix shape:** Move strings to `src/messages/{en,es}.json`, use `useTranslations("invite")`. Castilian Spanish, "skills" loanword.

### [M] `/launch` is hardcoded English (i18n gap) — `launch/page.tsx`, `launch/new/page.tsx`, `launch/[id]/page.tsx`

No `useTranslations()` calls. Spanish-locale users / NEL brand see all-English copy on the founder onboarding flow.
**Fix shape:** Mechanical: add `launch.*` namespace to message files, replace literals.

### [M] Duplicate-email check missing in /launch founder list — `launch/new/page.tsx:70-72`

Same email twice passes both client + server validation.
**Fix shape:** Client guard + server zod refinement on the `founders` array.

### [M] Legacy admin router still mounted — `src/server/routers/index.ts`

Two parallel admin auth paths coexist: legacy `adminRouter` (User table + `ADMIN_EMAIL` env + `admin_2fa_verified` cookie) and the canonical `platformAdminRouter` (PlatformAdmin table + magic link + `platform_admin_2fa_verified` cookie). Both are mounted; the legacy one is reachable from the tRPC root.
**Fix shape:** Confirm no UI calls `trpc.admin.*` anymore, then delete `routers/admin.ts`, the legacy `/api/admin-2fa-verify` route, and the `ADMIN_EMAIL` / `isAdminEmail()` helper.

### [M] Supervisor 2FA auto-setup vs admin manual button — `src/app/(supervisor)/supervise/verify/page.tsx:42-48`

Admin flow uses an explicit "Generate QR Code" button (per memory, fixed previously to break a useEffect loop). Supervisor flow still auto-triggers `setupMutation` in useEffect. Inconsistent and slightly more session-hijack-friendly.
**Fix shape:** Mirror the admin pattern.

---

## Polish (low priority)

- **[L] Privacy Notice jurisdiction fallback error is generic** — `deals/new/page.tsx:338-342`. When `parameterValues.jurisdictions` is empty for soloModeOnly types, error message is unhelpful.
- **[L] Auto-agree UX is invisible** — solo deals with all-single-option clauses jump to AGREED with no visible explanation.
- **[L] Solo mode stores unused `priority`/`flexibility=3`** — schema debt.
- **[L] `enable-feature-modal.tsx:61` hardcodes "€9/mo"** — doesn't read from `SkillPackage.priceAmount/priceCurrency`.
- **[L] Stripe success page poll race** — `billing/page.tsx:66-89`: 3-5s window where entitlement may not yet be visible.
- **[L] Type-to-sign forensic data is minimal** — only typed name + timestamp; no IP, no UA.
- **[L] No qualified-signature warning** — UI doesn't disclose that type-to-sign isn't eIDAS/ESIGN-qualified.
- **[L] Concurrent signing not row-locked** — checks-then-write pattern; corruption bounded by `alreadySigned` check, but no optimistic lock.
- ~~**[L] LawyerWarningModal not applied on /launch + /marketplace**~~ — **NOT APPLICABLE (verified 2026-04-29)**. /launch intentionally suppresses the modal because it has its own per-step lawyer-engagement surface ("Request lawyer review" dialog on each journey step). /marketplace is browsing, not committing — surfacing a warning there would be noise without a corresponding action. Existing design wins.
- **[L] Lawyer profile expert-type/specialization labels hardcoded English** — `lawyers/profile/page.tsx`.
- **[L] Company-name help text vs. validation mismatch** — /launch tells user "Inc., Corporation, or Company" but neither client nor server enforces it.
- **[L] MCP endpoint anonymous** — by design; same info exposed via `.well-known/agent.json`. Not a security issue, noted for completeness.
- **[L] Agent card missing `disputes:create` scope** — `.well-known/agent.json` doesn't advertise the dispute scope, so agent federation can't discover it.
- **[L] Stripe webhook logs lack structured context** — error logs don't include event.id / customer / subscription.

---

## Summary

- **4 ship-blockers [H]:** Gavel webhook fail-open, signing providers fictional, /launch equity not validated, invitation token replay.
- **18 real bugs [M]:** spread across negotiation races, signing stalls, agent-platform rate limits, i18n gaps in critical surfaces (invite, /launch), and the legacy admin auth path.
- **14 polish items [L].**

The strongest pattern across the audit: **value-prop drift** — public docs / CLAUDE.md / marketing claim capabilities (three signing providers, A2A rate limits, lawyer warnings everywhere, bilingual UX everywhere) that the code only partially delivers. Fixing the [H]s closes that gap on the riskiest surfaces. The [M]s on the agent platform (idempotency, atomic rate limits, dispute state) are a coherent batch worth fixing together.

---

## Layers 2 + 3 — outstanding

- **Layer 2 — Mobile responsiveness** at 375px and 768px across the same matrix. Best after L1 fixes land so layout bugs aren't tangled with logic ones.
- **Layer 3 — Value-prop / skill-content coverage:** per-skill bilingual rendering, jurisdiction-specific clauses, parameter→boilerplate bridges, no `[BRACKET]` leaks, compromise math sanity. Free 6 + Premium 27 + A2A 12.
