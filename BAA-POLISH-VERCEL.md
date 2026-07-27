# BAA polish — three product fixes in one deploy (Vercel one-shot)

Batches three fixes to the hosted Deal Room BAA skill into a **single** push,
a **single** curl, and a **single** cleanup. Supersedes the two prior one-shot
runbooks (`SEED-BAA-HOSTED-VERCEL.md`, `RETAG-PRIVACY-VERCEL.md`).

## What ships in this branch

**FIX A — no more "Unverified" badge (ships in the push, no DB step).**
`src/app/(dashboard)/deals/[id]/negotiate/page.tsx` no longer renders the
alarming grey "Unverified" pill when a clause option has no Cloud Intelligence
score. The numeric green/amber/red badge still renders when a score exists, and
the separate real-warning `AlertTriangle` is untouched. App-wide (all skills),
intended. The `unverified` / `unverifiedTooltip` i18n keys are left in place.

**FIX B — BAA governing law -> California, venue -> fillable (applies on curl).**
The committed seed content at `prisma/hosted-skills/baa-negotiator/` (kept
byte-identical to the private `legalskills/baa-negotiator/` source) now carries:
- `manifest.json` jurisdictions `["CALIFORNIA"]` (was `["NEW_YORK"]`). The app's
  `NEW_YORK` `GoverningLaw` enum value is left in place — untouched. `CALIFORNIA`
  already exists in the enum, so no migration is needed.
- `boilerplate.json` Section 21(c) governing law = **State of California**, venue
  = a party-designated bracket `[the exclusive court or arbitration forum the
  parties designate for disputes]`. The `except to the extent preempted by
  federal law (including HIPAA)` language is preserved.

**FIX C — one privacy category (applies on curl).**
`skills/dpa/metadata.json` and `skills/privacy-notice/metadata.json` now carry
`category { "en": "Privacy & Data Protection", "es": "Privacidad y Protección de
Datos" }` (was `"Privacy"`). This corrects future seeds; the curl retags rows
already on the hosted DB.

## The one combined route

`POST /api/admin/baa-polish` (nodejs, force-dynamic) does BOTH, idempotently,
**never deletes anything**:
1. **Re-seeds** `baa-negotiator` from the committed
   `prisma/hosted-skills/baa-negotiator/` content — the exact per-skill upserts
   the retired `seed-baa` route did (SkillPackage / ContractTemplate /
   ClauseTemplate / ClauseOption + premium pricing) — so the California
   jurisdiction and the new §21(c) venue land on the hosted DB.
2. **Retags** `ContractTemplate WHERE category = "Privacy"` ->
   `"Privacy & Data Protection"` (+ `categoryLocalized`) — the dpa /
   privacy-notice consolidation.

Guard (identical to the prior routes): Bearer token compared to `SEED_BAA_TOKEN`.
- `SEED_BAA_TOKEN` unset -> **403** (never runs unguarded)
- missing / wrong `Authorization` -> **401**

The hosted DB is only reachable over Postgres 5432 from **inside** the deployed
function (operator networks block outbound 5432), which is why FIXES B and C
land via this deployed route rather than a local `npm run db:seed`.

---

## Steps

### 1. Push `chore/baa-polish` to `main` — OPERATOR
Vercel auto-deploys `main`. Merge `chore/baa-polish` into `main`, or push the
branch and promote its preview to production — operator's choice, with the
operator's own git credentials. Nothing was pushed by the preparer; the branch
exists only locally.

```
# OPERATOR
git push origin chore/baa-polish
# then open/merge the PR into main, or promote the preview deploy
```

FIX A goes live with this deploy — no further action needed for the badge.

### 2. Set `SEED_BAA_TOKEN` fresh in Vercel production, redeploy — OPERATOR
In the Vercel project (RINDOGATAN/deal-room) -> Settings -> Environment
Variables, add for **Production** a fresh strong value:

```
SEED_BAA_TOKEN = <a long random secret, e.g. `openssl rand -hex 32`>
```

Redeploy (or let step 1's deploy pick it up) so the env var is live in the
running function.

### 3. After the deploy is live, run the one-shot — OPERATOR

```
# OPERATOR
curl -X POST https://dealroom.todo.law/api/admin/baa-polish \
  -H "Authorization: Bearer <the SEED_BAA_TOKEN value>"
```

Expected success response. `baa.updated` is `true` when the skill row already
existed; `categories.matched`/`updated` are the number of rows that carried the
legacy `"Privacy"` label — expect **2** on first run, **0** on re-runs (both
operations are idempotent):

```json
{
  "ok": true,
  "baa": {
    "updated": true,
    "version": "1.2.0",
    "jurisdictions": ["CALIFORNIA"],
    "packageHash": "<sha256 of clauses.json>"
  },
  "categories": {
    "matched": 2,
    "updated": 2
  }
}
```

Guard behavior to expect:
- No/blank `SEED_BAA_TOKEN` on the server -> `403 {"ok":false,"error":"SEED_BAA_TOKEN is not configured on the server."}`
- Wrong or missing bearer token -> `401 {"ok":false,"error":"Unauthorized"}`

### 4. Verify in the UI — OPERATOR
- **No "Unverified" badges** anywhere in the negotiate view — clause options
  without a score show no pill (numeric green/amber/red badges still appear when
  a score exists; real warnings still show the amber triangle).
- **BAA governing law reads California** with a **fillable venue** — open a BAA
  deal, generate the document, and confirm Section 21(c) reads "State of
  California" with the bracketed `[the exclusive court or arbitration forum the
  parties designate for disputes]` placeholder for the parties to complete.
- **Only "Privacy & Data Protection"** — the standalone **Privacy** category is
  gone; `dpa` and `privacy-notice` now cluster with `baa-negotiator` /
  `dpia-companion`.

### 5. CLEANUP (follow-up commit) — OPERATOR
This route is a one-shot. Once all three fixes are confirmed:
1. **Remove the ROUTE, KEEP all source content/UI fixes.**
   - delete `src/app/api/admin/baa-polish/route.ts`
   - **do NOT revert**: FIX A (`negotiate/page.tsx`), FIX B
     (`prisma/hosted-skills/baa-negotiator/` content) or FIX C
     (`skills/dpa/metadata.json`, `skills/privacy-notice/metadata.json`). Those
     are permanent correctness and keep future seeds consistent.
2. Commit + push + let it deploy.
3. **Delete `SEED_BAA_TOKEN`** from Vercel Production env.

The route is inert until called with the token, so leaving it briefly is not a
data risk — removing it closes the surface entirely.

---

## Notes on fidelity
- The route uses the shared, Neon-retry-wrapped `@/lib/prisma` client, exactly
  as the seed-baa and retag-privacy routes did.
- The seed block is replicated verbatim from `prisma/seed.ts`'s per-skill branch
  (only the Prisma client source differs). `packageHash = sha256(clauses.json)`
  matches a local seed byte-for-byte.
- The category write is a single `updateMany` scoped to `category = "Privacy"`;
  no other category is touched, and nothing is ever deleted.
- The `legalskills/baa-negotiator/` private source and the committed
  `prisma/hosted-skills/baa-negotiator/` copy are kept identical for the five
  seed files (`manifest.json`, `metadata.json`, `boilerplate.json`,
  `clauses.json`, `SKILL.md`).
