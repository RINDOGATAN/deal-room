# Contributing to Dealroom

Thanks for considering a contribution. Dealroom is a two-party contract
negotiation platform (Next.js App Router + tRPC + Prisma + PostgreSQL),
licensed AGPL-3.0-or-later.

## Development setup

```bash
npm install
cp deploy/sovereign/.env.example .env   # or craft your own; never commit .env*
npx prisma generate && npx prisma db push
npx prisma db seed
npm run dev
```

You need Node.js 20+ and a PostgreSQL database. `CLAUDE.md` is the
operator's manual — read it before touching auth, licensing, or the
compromise engine.

## Quality gates

All of these must pass before a PR is mergeable:

```bash
npm run lint          # eslint — keep it green; don't add ignores without a comment
npx tsc --noEmit      # typecheck
npm run test:run      # vitest
npm run check:skills  # skill content guard (i18n parity, placeholder leaks, jurisdictions)
npm run check:api     # API error-handling guard
```

Add tests with behavioral value for anything touching routers, auth,
licensing, or the compromise engine — not just coverage filler.

## Conventions

- **Commits:** conventional-ish — `feat(scope): …`, `fix(scope): …`,
  `chore(scope): …`. Present tense, explain *why* in the body when the diff
  doesn't.
- **i18n:** every user-facing string exists in **both** `src/messages/en.json`
  and `src/messages/es.json`. The EN/ES parity of this codebase is a feature;
  don't regress it.
- **Logging:** no bare `console.*` in `src/` — use the project logger and
  never log secrets, tokens, or personal data.
- **Skills content:** clause text follows the bracket-token rules enforced by
  `scripts/check-skills.mjs` (lower-case fill-ins, declared parameter tokens,
  no ALL-CAPS/Title-Case leftovers). Skills are baked copies of the upstream
  `legalskills` catalog — see `docs/skills-sync.md` before editing them
  in-place.
- **Secrets & PII:** nothing real in fixtures, seeds, docs, or tests.
  Obviously-fictional data only (`jane.doe@example.com`, bar number
  `#000000`).

## Pull requests

1. Branch from `main`.
2. Keep PRs focused; separate mechanical churn from behavior changes.
3. Describe the user-visible effect and any migration/deployment impact
   (especially anything under `deploy/sovereign/`).

## Licensing of contributions

By submitting a contribution you agree it is licensed under
AGPL-3.0-or-later, the project license. If you cannot agree to that,
don't submit the change.
