# Shipping the BAA Negotiator free in the self-host bundle

How the polished **BAA Negotiator** (`BAA_NEGOTIATOR` / `com.nel.skills.baa-negotiator`)
becomes part of a fresh self-host / Mac install of the todo.law suite **for free**,
while staying **€9/mo premium on cloud** (dealroom.todo.law).

Written 2026-07-27 after making it live on the local suite install
(`/Users/sme/todo-law`). **Update 2026-07-29:** the Option B `seed.ts` change
recommended in §3 has since shipped as `db16c80` and is tagged `v0.1.13`, so
self-host installs pulling `:latest` already include the bundled BAA.

---

## TL;DR

- **The free-ness needs no per-skill gate and no offline licence.** It is
  *deployment-derived*: self-host configures **no Stripe**, so
  `features.allSkillsFree` is `true` and every entitlement check short-circuits
  to `{ entitled: true }`. Cloud sets Stripe, so the same `isPremium=true` /
  €9 row is enforced. baa is a normal premium row; only the deployment differs.
- **The one real gap for a *fresh* bundle:** baa's content lives in
  `prisma/hosted-skills/baa-negotiator/`, which the first-boot seed does **not**
  scan. Fix = one small `seed.ts` change (below). No Dockerfile change — the
  migrator image already carries the content.
- **Category consolidation needs no action** — `skills/dpa/metadata.json` and
  `skills/privacy-notice/metadata.json` already carry `"Privacy & Data
  Protection"`, so a fresh seed clusters DPA + Privacy Notice + BAA correctly.

---

## 1. The free mechanism (verified, no change required)

`src/config/features.ts`:

```
const stripeConfigured =
  !!process.env.STRIPE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true";

allSkillsFree:
  !stripeConfigured ||
  process.env.NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS === "true" ||
  process.env.FREE_TRIAL_ALL_SKILLS === "true",
```

`src/server/services/licensing/entitlement.ts` — both `checkEntitlement` and
`checkDealCreationEntitlement` begin with `if (features.allSkillsFree) return
{ entitled: true }`.

- **Self-host** (this suite, and the sovereign compose): sets **neither**
  `STRIPE_SECRET_KEY` nor `NEXT_PUBLIC_STRIPE_ENABLED` → `stripeConfigured=false`
  → `allSkillsFree=true` → baa is free, **no licence, no paywall**. The sovereign
  compose additionally sets `FREE_TRIAL_ALL_SKILLS=true` and builds the image with
  `NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS=true` (belt-and-suspenders so the *client*
  bundle agrees and the promo banner renders). Either leg alone is sufficient.
- **Cloud**: sets `STRIPE_SECRET_KEY` **and** `NEXT_PUBLIC_STRIPE_ENABLED=true`
  → `stripeConfigured=true`, and does **not** set the promo var →
  `allSkillsFree=false` → baa stays €9/mo (`isPremium=true`, `priceAmount=900`,
  `priceCurrency=eur`).

**So the business rule is satisfied structurally.** The correct mechanism is
"self-host = no Stripe", *not* a `SELF_HOSTED` flag and *not* making baa a
non-premium built-in. `isPremium` stays `true` in both worlds; only Stripe
presence changes.

Proven on the running local container 2026-07-27:

```
features.allSkillsFree = true   features.stripeEnabled = false
checkDealCreationEntitlement(BAA_NEGOTIATOR) = {"entitled":true,"reason":"Free during launch promotion"}
checkEntitlement(baa-negotiator)             = {"entitled":true,"reason":"Free during launch promotion"}
```

Container env confirmed: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_ENABLED`,
`FREE_TRIAL_ALL_SKILLS`, `NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS` all **unset** — the
free-ness rides purely on the absence of Stripe.

---

## 2. What ships where (image layers)

The sovereign build (`deploy/sovereign/Dockerfile`) is multi-stage:

| Stage    | Contains                                                  | Role                          |
|----------|-----------------------------------------------------------|-------------------------------|
| builder  | full repo `COPY . .` incl. `prisma/hosted-skills/`, tsx, prisma CLI, `seed.ts` | **also the migrator image** (`deal-room-migrator`) |
| runner   | `.next/standalone` + `public` + `skills/` + `data/`       | the app (`deal-room`)         |

Key facts:

- The **migrator image already contains** `prisma/hosted-skills/baa-negotiator/`
  (verified: `docker run --rm deal-room-builder:local ls prisma/hosted-skills`).
  So **no Dockerfile change is needed** to ship the content — only the seed must
  *scan* it.
- Contract **rendering reads clause/boilerplate content from the DB**, not from
  the runner image. So the runner does not need the baa files; it needs the
  polished **code** (the `sequentialNumbering` renderer in
  `src/server/services/document/generator.ts` + the removed "Unverified" badge),
  which is already in `main` at `f359ec7` and therefore in any freshly built runner.

---

## 3. The gap and the fix (fresh installs)

`prisma/seed.ts` builds `skillEntries` from exactly two sources:

1. `BUILTIN_SKILLS_DIR` = `prisma/../skills` (dpa, nda, msa, saas, privacy-notice, delaware)
2. `SKILLS_DIR` env (cloud → the licensed `legalskills` repo. Note: as of
   2026-07-29 `legalskills` does **not** carry baa — the hosted DB got it via
   the one-shot reseed removed in `f359ec7`, and future baa content edits must
   be seeded manually from this repo's `prisma/hosted-skills/`, or the skill
   copied into `legalskills` to ride the normal seed workflow)

`prisma/hosted-skills/` is **neither**. On self-host `SKILLS_DIR` is empty (or a
blank installed-skills volume), so a fresh first-boot seed produces built-ins
only — **baa never appears**. (`seed-marketplace.ts` only adds zero-clause
*stub* listings, and baa is not even in that list.)

### Recommended fix — Option B (surgical, cloud-safe)

Add a self-host-only scan of `prisma/hosted-skills/` to `seed.ts`, gated on the
**absence** of `SKILLS_DIR` (the same "SKILLS_DIR set == hosted" signal that
`seed-marketplace.ts` already uses). Cloud sets `SKILLS_DIR`, so this pass is
skipped there and cloud keeps getting baa only from `legalskills` — zero cloud
blast radius. Insert after the `SKILLS_DIR` block (~line 226):

```ts
const HOSTED_SKILLS_DIR = path.join(__dirname, "hosted-skills");
// Bundled premium content shipped FREE in the self-host bundle. Only when no
// external SKILLS_DIR (cloud points that at the licensed legalskills repo,
// which already carries these). Keeps built-in skills/ = free-everywhere and
// hosted-skills/ = premium content free on self-host.
if (!SKILLS_DIR && fs.existsSync(HOSTED_SKILLS_DIR)) {
  for (const dir of fs.readdirSync(HOSTED_SKILLS_DIR)) {
    if (dir.startsWith(".") || dir.startsWith("_")) continue;
    const fullPath = path.join(HOSTED_SKILLS_DIR, dir);
    if (!fs.statSync(fullPath).isDirectory()) continue;
    const i = skillEntries.findIndex((e) => e.name === dir);
    if (i >= 0) skillEntries[i] = { name: dir, path: fullPath };
    else skillEntries.push({ name: dir, path: fullPath });
  }
}
```

The existing `premiumSkillIds` loop (already lists
`com.nel.skills.baa-negotiator`) then marks it `isPremium=true` + €9 — free on
self-host via §1, enforced on cloud.

### Alternative — Option A (simplest)

`git mv prisma/hosted-skills/baa-negotiator skills/baa-negotiator`. Then the
built-in scan picks it up on every install with **zero seed-code change**.
Downside: on a fresh *cloud* first boot baa also seeds from built-in (harmless —
the `legalskills` external pass overrides the same-named dir, and it's already
public AGPL content in this repo). Choose A if you'd rather not touch `seed.ts`;
choose B to preserve the "hosted-skills = staged premium" separation and keep
cloud's seed path unchanged.

### Existing installs (upgrades), not just fresh ones

`deploy/sovereign/migrate.sh` runs the full seed **only on first boot** (skips
when users already exist). So Option A/B covers **fresh** installs. For an
**already-provisioned** self-host box to pick baa up on upgrade, either:

- run the one-shot reseed manually (the exact command in §5 "existing install"), or
- (more robust for a fleet) move the hosted-skills seeding into the additive,
  every-boot `db:seed-marketplace` step so upgrades self-heal. That needs the
  skill-processing loop refactored into a reusable function — larger change,
  deferred.

---

## 4. Operator steps to cut a bundle that includes baa (free)

**Dev, once:**
1. Apply the Option B `seed.ts` change (or Option A move). Confirm baa's
   `metadata.json` category is `"Privacy & Data Protection"` (it is), and that
   dpa + privacy-notice metadata match (they do). Commit.
2. `npm run test:run` (the renderer has golden tests; 188/188 green at f359ec7).

**Cut the images (multi-arch, GHCR) — the normal release path:**
3. Bump `TODOLAW_VERSION` and build/push both `deal-room` (runner) and
   `deal-room-migrator` (builder) images with the operator's GHCR creds. The
   migrator image carries `prisma/hosted-skills/` + the updated `seed.ts`; the
   runner carries the polished renderer. **No signing key, no Blob/KV, no
   offline-licence tooling** — those belong to the *paid* .skill path, which the
   free self-host gate replaces.

**Fresh install (operator or end user, on any Mac):**
4. `cp .env.example .env`; set the DB passwords + a bridge key. **Leave all
   Stripe vars empty** (this is what makes premium skills free).
5. `docker compose up -d`. First boot: the deal-migrator runs the seed →
   built-ins + `hosted-skills/baa-negotiator` → baa is live.
6. Verify in-app: baa shows under **Privacy & Data Protection**, opens straight
   into the wizard with **no paywall / no licence prompt**, and a generated BAA
   renders as one clean **1–21** agreement (California governing law, fillable
   venue bracket in §21(c), no "Unverified" badges).

---

## 5. What was done to THIS local install (it was pre-existing, not fresh)

`/Users/sme/todo-law` already had users + stale baa (NEW_YORK, "Privacy",
pre-renderer), so first-boot auto-seed did not apply. Steps taken (all local,
nothing pushed):

- Rebuilt both images from `main@f359ec7` via `deploy/sovereign/Dockerfile`
  (`--target builder` → `deal-room-builder:local`; `--target runner` →
  `ghcr.io/rindogatan/deal-room:latest`), and recreated
  `todolaw-suite-dealroom-1` (DB + other suite containers preserved).
- Reseeded the polished baa into the local DB by running the seed against the
  live DB with `SKILLS_DIR` pointed at the baked hosted-skills dir — this is the
  manual equivalent of the Option B scan, and the reusable "existing install"
  command:

  ```
  docker run --rm --network todolaw-suite_default \
    -e DATABASE_URL="postgresql://dealroom:<DEAL_DB_PASSWORD>@deal-db:5432/dealroom" \
    -e DATABASE_URL_UNPOOLED="postgresql://dealroom:<DEAL_DB_PASSWORD>@deal-db:5432/dealroom" \
    -e SKILLS_DIR=/app/prisma/hosted-skills \
    deal-room-builder:local npm run db:seed
  ```

  (`<DEAL_DB_PASSWORD>` = `DEAL_DB_PASSWORD` from `/Users/sme/todo-law/.env`.)
  The premium loop marked baa `isPremium=true` / €9 — free locally via no-Stripe.
- Applied the category consolidation on the stale DPA/Privacy-Notice rows with a
  one-off `UPDATE contract_templates SET category='Privacy & Data Protection' …`
  (fresh installs won't need this — the metadata already carries it).

No rehearsal deals had to be deleted: the FK error that bit the earlier
`skillManager.install` path (`clauseTemplate.deleteMany`) does not occur on the
**seed/upsert** path used here, so the two rehearsal baa deals were left intact.
