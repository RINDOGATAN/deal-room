# Skills sync — drift detection against legalskills

## Why

The `skills/` directory is a **frozen, baked copy** of the upstream
`RINDOGATAN/legalskills` repo. Once baked, nothing records which upstream state it came
from — provenance today is a flat `version: "1.0"` in each `metadata.json`.
That means an edit made directly in `skills/` (a "hotfix" that never lands
upstream), or an upstream fix that never gets re-baked here, is invisible
until a contract renders wrong. `scripts/skills-sync.mjs` makes that drift
mechanically checkable.

## How the manifest works

`manifest` mode walks every skill directory (skipping `_*`/`.*` and anything
without a skill marker file — same scope as `check-skills.mjs` and the seed
loader) and records, per skill, a sorted map of relative file path →
SHA-256 of file content. It then derives an aggregate digest per skill and a
single set digest over all skills, both computed from sorted `path:hash`
lines, so the output is deterministic across platforms and re-runs.

## Commands

```sh
# Write a checksum manifest (default: skills/manifest.sha256.json)
node scripts/skills-sync.mjs manifest [--dir skills] [--out <file>]

# Compare local skills/ against a legalskills checkout (hashed on the fly)
# or a previously written manifest file. Exit 0 = clean, 1 = drift.
node scripts/skills-sync.mjs diff --ref ../legalskills [--dir skills]
node scripts/skills-sync.mjs diff --ref skills/manifest.sha256.json
```

A directory `--ref` may be either the skills root itself or a checkout whose
skills live in a `skills/` subdirectory — the script detects the layout.
Drift output lists added/removed/changed files per skill, from the local
perspective ("added" = exists locally, not in the ref).

## Suggested workflow

- **When re-baking** skills from legalskills: copy the files, then regenerate
  the manifest and commit it alongside, recording the upstream commit SHA in
  the same commit message.
- **In CI**: check out the pinned legalskills SHA and run
  `node scripts/skills-sync.mjs diff --ref <checkout>` so any local hotfix or
  silent upstream divergence fails the build instead of shipping quietly.

## What this stub does NOT do

- No auto-update — it only reports drift; re-baking stays a manual copy.
- No signature verification — checksums prove *sameness*, not *authenticity*
  (the Ed25519 machinery in `src/lib/crypto.ts` is about skill *packages*,
  not this directory).
- No upstream SHA tracking — the manifest doesn't know which legalskills
  commit it corresponds to unless you record that alongside it.
