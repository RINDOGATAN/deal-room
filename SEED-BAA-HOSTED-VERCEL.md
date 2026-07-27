# Seed `baa-negotiator` onto the HOSTED Deal Room (Vercel one-shot)

## Why this exists

The normal seed path is `npm run db:seed` (`prisma/seed.ts`) with `SKILLS_DIR`
pointing at the private `legalskills` checkout, run from the operator's laptop
against Neon over Postgres port **5432**. Some operator networks (WiFi and
hotspot both observed) block outbound 5432, so the local seed cannot reach the
hosted DB. The **deployed app runs inside AWS and reaches Neon fine**, so we let
a guarded, deployed API route perform the exact same per-skill upserts.

This route:
- reads skill content committed at `prisma/hosted-skills/baa-negotiator/`
  (`manifest.json`, `metadata.json`, `clauses.json`, `boilerplate.json`),
- performs the **same idempotent upserts** `seed.ts` does for this one skill
  (SkillPackage + ContractTemplate incl. `category` + ClauseTemplate +
  ClauseOption),
- applies premium treatment (`isPremium=true`, `priceAmount=900`,
  `priceCurrency="eur"`, `stripePriceId=STRIPE_PRICE_ID`),
- **never deletes anything** — safe to call more than once.

Route: `POST /api/admin/seed-baa`
Guard: Bearer token compared to `SEED_BAA_TOKEN`.
- `SEED_BAA_TOKEN` unset -> **403** (never runs unguarded)
- missing / wrong `Authorization` -> **401**

---

## Steps

### 1. Push the branch or merge to `main` — OPERATOR
Vercel auto-deploys `main`. Either merge `chore/seed-baa-hosted` into `main`, or
push the branch and promote its preview to production — operator's choice, with
operator's own git credentials.

```
# OPERATOR
git push origin chore/seed-baa-hosted
# then open/merge the PR into main, or promote the preview deploy
```

Nothing was pushed by the preparer. The branch exists only locally.

### 2. Set `SEED_BAA_TOKEN` in Vercel production env — OPERATOR
In the Vercel project (RINDOGATAN/deal-room) -> Settings -> Environment
Variables, add for **Production**:

```
SEED_BAA_TOKEN = <a long random secret you generate>
```

Optionally confirm `STRIPE_PRICE_ID` is already set in Production (it is what
the premium price binds to; the seed uses whatever is configured, or `null` if
absent — same behavior as `prisma/seed.ts`).

Redeploy (or let step 1's deploy pick it up) so the env var is live in the
running function.

### 3. After the deploy is live, run the one-shot — OPERATOR

```
# OPERATOR
curl -X POST https://dealroom.todo.law/api/admin/seed-baa \
  -H "Authorization: Bearer <the SEED_BAA_TOKEN value>"
```

Expected success response (`created` is `true` on first run, `false` on
re-runs since the upserts are idempotent):

```json
{
  "ok": true,
  "created": true,
  "updated": false,
  "skillId": "com.nel.skills.baa-negotiator",
  "version": "1.2.0",
  "isPremium": true,
  "price": {
    "amount": 900,
    "currency": "eur",
    "stripePriceId": "price_...",
    "display": "€9/mo"
  },
  "category": "Privacy & Data Protection",
  "contractType": "BAA_NEGOTIATOR",
  "clauseCount": 7,
  "optionCount": 21,
  "packageHash": "<sha256 of clauses.json>"
}
```

Guard behavior to expect:
- No/blank `SEED_BAA_TOKEN` on the server -> `403 {"ok":false,"error":"SEED_BAA_TOKEN is not configured on the server."}`
- Wrong or missing bearer token -> `401 {"ok":false,"error":"Unauthorized"}`

### 4. Verify in the UI — OPERATOR
- The **HIPAA BAA Negotiator** skill appears under the **Privacy & Data
  Protection** category, priced at **€9/mo** (premium/paywalled).
- Starting a `BAA_NEGOTIATOR` deal, **New York** is selectable as governing law.
- The 7 negotiation clauses and their options render.

### 5. CLEANUP (follow-up commit) — OPERATOR
This route is a one-shot. Once the seed is confirmed:
1. Remove the route and (optionally) the tracing-include + committed content:
   - delete `src/app/api/admin/seed-baa/route.ts`
   - delete the `"/api/admin/seed-baa"` entry in `next.config.ts`
     `outputFileTracingIncludes`
   - delete `prisma/hosted-skills/baa-negotiator/` (optional — inert once the
     route is gone)
2. Commit + push + let it deploy.
3. **Unset `SEED_BAA_TOKEN`** in Vercel Production env.

The route is inert until called with the token, so leaving it briefly is not a
data risk — but removing it closes the surface entirely.

---

## Notes on fidelity
- Per-skill logic is **replicated** from `prisma/seed.ts`, not imported:
  `seed.ts` calls `main()` at module load and would run the entire multi-table
  production seed as an import side effect. Only the Prisma client source
  differs (this route uses the shared Neon-retry-wrapped `@/lib/prisma`).
- `packageHash` is the SHA-256 of the raw `clauses.json` bytes, matching a
  local seed byte-for-byte.
- `category` comes from `metadata.json` (`"Privacy & Data Protection"`), exactly
  as `seed.ts` resolves it.
