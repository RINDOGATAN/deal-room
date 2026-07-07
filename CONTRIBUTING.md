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

- **Licensing**: this project is published under **AGPL-3.0-or-later**, and
  Rindogatan also offers it under a separate commercial licence. So that both
  are possible, every contribution is covered by the
  [Contributor License Agreement](CLA.md) and certified per commit with the
  [Developer Certificate of Origin](DCO.txt). Do not submit code you don't have
  the right to license this way.
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

## Licensing your contribution

Two things travel with every contribution:

1. **Sign off each commit (DCO).** Add `Signed-off-by: Your Name
   <you@example.com>` to every commit — `git commit -s` does it for you. This
   certifies you wrote the code or have the right to submit it (see
   [DCO.txt](DCO.txt)). Use your real name.
2. **Sign the CLA once.** The first time you open a PR, accept the
   [Contributor License Agreement](CLA.md): add your name to [AUTHORS](AUTHORS)
   in the same PR and state in the PR description that you have read and accept
   the CLA. The CLA grants Rindogatan the relicensing right that makes the dual
   licence (AGPL + commercial) possible. You keep the copyright to your work; it
   is a licence, not an assignment. Contributing on behalf of an employer? Have
   them execute a Corporate CLA (email legal@rindogatan.com).

PRs without a DCO sign-off, or from a contributor who has not accepted the CLA,
cannot be merged.

## Pull requests

1. Branch from `main`.
2. Keep PRs focused; separate mechanical churn from behavior changes.
3. Describe the user-visible effect and any migration/deployment impact
   (especially anything under `deploy/sovereign/`).

## SPDX headers

Every source file carries a machine-readable licence header as its first lines
(after a shebang or a `"use client"` / `"use server"` directive, if present):

```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC
```

New source files must include it. These headers survive copy-paste into other
codebases and make the licence and its owner unambiguous. Do not remove or alter
them. `scripts/add-spdx-headers.mjs` adds the header to any file missing it.
