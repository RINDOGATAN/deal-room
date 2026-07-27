# Consolidate "Privacy" into "Privacy & Data Protection" (Vercel one-shot)

## Why this exists

The operator sees two privacy categories on the **hosted** Deal Room:

- **Privacy** — `dpa`, `privacy-notice`
- **Privacy & Data Protection** — `baa-negotiator`, `dpia-companion`

They should be one. The **source-of-truth fix is already committed** on this
branch: `skills/dpa/metadata.json` and `skills/privacy-notice/metadata.json`
now carry `category { "en": "Privacy & Data Protection", "es": "Privacidad y
Protección de Datos" }`. That corrects any future seed.

But `ContractTemplate` rows already on the **hosted** DB still read the old
`"Privacy"` label, and the hosted DB is only reachable over Postgres **5432**
from inside the deployed function (operator networks block outbound 5432). So a
guarded, deployed API route retags those rows in place — same rationale and
same auth model as the retired `seed-baa` route.

This route:
- runs a single idempotent `updateMany`:
  `ContractTemplate WHERE category = "Privacy"` ->
  `category = "Privacy & Data Protection"` **and**
  `categoryLocalized = {"en":"Privacy & Data Protection","es":"Privacidad y Protección de Datos"}`,
- **never deletes anything** — safe to call more than once (matches 0 rows once done).

Route: `POST /api/admin/retag-privacy`
Guard: Bearer token compared to `SEED_BAA_TOKEN` (the **same** env var the
seed-baa route used — the operator sets one variable).
- `SEED_BAA_TOKEN` unset -> **403** (never runs unguarded)
- missing / wrong `Authorization` -> **401**

---

## Steps

### 1. Push the branch to `main` — OPERATOR
Vercel auto-deploys `main`. Merge `chore/retag-privacy` into `main`, or push the
branch and promote its preview to production — operator's choice, with the
operator's own git credentials.

```
# OPERATOR
git push origin chore/retag-privacy
# then open/merge the PR into main, or promote the preview deploy
```

Nothing was pushed by the preparer. The branch exists only locally.

### 2. Set `SEED_BAA_TOKEN` in Vercel production env — OPERATOR
In the Vercel project (RINDOGATAN/deal-room) -> Settings -> Environment
Variables, add for **Production** a fresh strong value:

```
SEED_BAA_TOKEN = <a long random secret you generate, e.g. `openssl rand -hex 32`>
```

Redeploy (or let step 1's deploy pick it up) so the env var is live in the
running function.

### 3. After the deploy is live, run the one-shot — OPERATOR

```
# OPERATOR
curl -X POST https://dealroom.todo.law/api/admin/retag-privacy \
  -H "Authorization: Bearer <the SEED_BAA_TOKEN value>"
```

Expected success response (`matched`/`updated` are the number of rows that
carried the legacy `"Privacy"` label — expect **2** on first run, **0** on
re-runs since the update is idempotent):

```json
{
  "ok": true,
  "matched": 2,
  "updated": 2,
  "from": "Privacy",
  "to": "Privacy & Data Protection"
}
```

Guard behavior to expect:
- No/blank `SEED_BAA_TOKEN` on the server -> `403 {"ok":false,"error":"SEED_BAA_TOKEN is not configured on the server."}`
- Wrong or missing bearer token -> `401 {"ok":false,"error":"Unauthorized"}`

### 4. Verify in the UI — OPERATOR
- Only **Privacy & Data Protection** remains; the standalone **Privacy**
  category is gone.
- `dpa` (Data Processing Agreement) and `privacy-notice` (Privacy Notice) now
  cluster under **Privacy & Data Protection** alongside `baa-negotiator` and
  `dpia-companion`.

### 5. CLEANUP (follow-up commit) — OPERATOR
This route is a one-shot. Once the retag is confirmed:
1. **Remove the ROUTE, KEEP the source metadata fix.**
   - delete `src/app/api/admin/retag-privacy/route.ts`
   - **do NOT revert** the `skills/dpa/metadata.json` and
     `skills/privacy-notice/metadata.json` category changes — those are
     permanent correctness and are what keeps future seeds consistent.
2. Commit + push + let it deploy.
3. **Unset `SEED_BAA_TOKEN`** in Vercel Production env.

The route is inert until called with the token, so leaving it briefly is not a
data risk — but removing it closes the surface entirely.

---

## Notes on fidelity
- The route uses the shared, Neon-retry-wrapped `@/lib/prisma` client, exactly
  as the seed-baa route did.
- The write is a single `updateMany` scoped to `category = "Privacy"`; no other
  category is touched, and nothing is ever deleted.
- `categoryLocalized` is set to the exact strings `baa-negotiator` uses, so all
  four skills render an identical category label.
