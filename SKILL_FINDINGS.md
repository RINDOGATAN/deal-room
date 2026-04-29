# Skill-Content Audit — Layer 3

**Date:** 2026-04-29
**Scope:** the 6 free skills shipped in `skills/` (premium 27 + A2A 12 live in private `RINDOGATAN/legalskills` and need to be audited there separately).

A new static guard now runs the most mechanical of these checks at every commit:
```
npm run check:skills
```
The script also accepts `SKILLS_DIR=/path/to/legalskills` so the same rules apply to the premium catalog.

---

## What `check:skills` validates

1. Required files (`clauses.json`, `metadata.json`, `boilerplate.json`).
2. JSON parses.
3. Every i18n string carries every language declared in `metadata.languages`.
4. No leftover `[BRACKET]` placeholders in boilerplate.
5. Every `{curly}` boilerplate variable is either a system var (party state, signature blocks, effective date — list at `src/server/services/document/generator.ts:349-361`) or declared as `boilerplateVariable` in `parameters.json`.
6. `clauseCount` matches actual clause count.
7. Jurisdictions are valid.
8. Every clause option has `biasPartyA` + `biasPartyB`. (Warning, not error — seed defaults missing values to `0`.)

---

## Findings on the 6 free skills (after fixes)

### 0 errors. 111 warnings.

All 111 warnings are the same pattern: clause options missing explicit `biasPartyA`/`biasPartyB`.

### [H] 4 of 6 free skills have **no bias values at all** — compromise math is half-broken

| Skill | biasPartyA occurrences in clauses.json |
|---|---|
| dpa | 44 ✓ |
| privacy-notice | 21 ✓ |
| **delaware-certificate-of-incorporation** | **0** |
| **nda** | **0** |
| **msa** | **0** |
| **saas** | **0** |

The compromise formula is documented in CLAUDE.md and memory:
```
stake = ((5 - flexibility)/5 * 0.6) + (|bias| * 0.4)
```

When every option has `bias = 0`, the `|bias| * 0.4` term is dead. Stake collapses to pure firmness:
```
stake = (5 - flexibility)/5 * 0.6
```

That has two effects on the negotiation experience:
1. **The 40% bias-weighted axis is silently disabled.** The "weighted compromise" tagline in marketing implies both axes are live; on these 4 skills, only one is.
2. **Compromise suggestions become symmetric.** The algorithm has no way to reward the party whose preferred option was inherently more reasonable for them — every divergence is resolved on firmness alone, which means the firmer party always wins. Half the value of the algorithm is missing.

**Fix shape (out of auto-mode scope — needs legal authoring):**
For every option of every clause across nda, msa, saas, delaware-cert, assign `biasPartyA` ∈ [-1, 1] and `biasPartyB` ∈ [-1, 1] reflecting how strongly that option favors each party. The dpa and privacy-notice skills are the model — borrow their style. This is ~110 options × 2 numbers = 220 values that need legal-domain reasoning. Worth doing as its own focused authoring pass.

Until that lands, the warning count from `check:skills` is a tracked-debt indicator: it should drop as biases get authored in.

### [M] (already fixed in this session)

- `msa/metadata.json` `clauseCount: 10` → actual 11 → fixed.
- `nda/metadata.json` `clauseCount: 10` → actual 9 → fixed.

### Surfaces verified clean

- All required files present in all 6 skills.
- JSON valid in all skills.
- All i18n strings carry both `en` and `es` (delaware-cert is single-language `["en"]` by design — also verified clean).
- No `[BRACKET]` leaks in any boilerplate.
- All `{curly}` vars resolve (system vars or `boilerplateVariable` declarations).
- All jurisdictions valid (`CALIFORNIA`, `ENGLAND_WALES`, `SPAIN`).
- `partyASignatureBlock` / `partyBSignatureBlock` are system-injected from `generator.ts` (added to the script's whitelist).

---

## Premium + A2A skills — not audited here

The 27 premium skills + 12 A2A skills live in `RINDOGATAN/legalskills`. To run the same checks against them:
```
SKILLS_DIR=/path/to/legalskills npm run check:skills
```
Likely candidates for warnings: same missing-bias pattern, since the legalskills catalog has been growing rapidly. Worth a one-time pass.

---

## Layers wrap-up

- **Layer 1 — logic:** complete. 4 [H] resolved, 18 [M] + 14 [L] flagged in `AUDIT_FINDINGS.md`.
- **Layer 2 — mobile responsiveness:** complete. 4 [H] supervisor + 3 [M] page-level + slider thumb resolved; remaining [L]s flagged in `MOBILE_FINDINGS.md`.
- **Layer 3 — value-prop / skill content:** structural issues resolved. Bias-authoring across 4 skills is the remaining real value-prop gap — needs domain expertise, not code changes.
