// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Contract-pack exporter.
 *
 * Publishes Dealroom's DPA know-how as a self-contained, versioned snapshot
 * a sibling app (DPO Central) can generate documents from on its own — no
 * API calls, no account on Dealroom. The pack contains:
 *
 *   dpa/*.json          — the skill source, verbatim (clauses with every
 *                         option variant, boilerplate with annexes and
 *                         conditional sections, parameters, metadata)
 *   derived-texts.json  — every generator-authored passage, fully
 *                         enumerated per variant and language (DPF
 *                         mechanism, TIA conclusion, UK/Swiss sections,
 *                         importer statements, fallbacks) plus the token
 *                         translation map
 *   manifest.json       — schema version, source commit, sha256 per file
 *
 * Everything is EXTRACTED from the live code paths (DERIVED_TEXTS constant
 * and the exported builder functions), never hand-copied, so re-running
 * the exporter after any DPA change refreshes the pack losslessly:
 *
 *   npm run pack:dpo -- /path/to/dpocentral/src/lib/dealroom/contract-pack
 *
 * INSTRUCTIONS.md in the destination is hand-authored and never touched.
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { DERIVED_TEXTS } from "@/server/services/document/derivedTexts";
import {
  buildTransferAddendaSections,
  buildTiaImporterStatements,
} from "@/server/services/document/generator";
import { TOKEN_TRANSLATIONS } from "@/lib/parameters";

const outDir = process.argv[2];
if (!outDir) {
  console.error("Usage: npm run pack:dpo -- <output-directory>");
  process.exit(2);
}

const SKILL_DIR = path.join(process.cwd(), "skills", "dpa");
const SKILL_FILES = ["clauses.json", "boilerplate.json", "parameters.json", "metadata.json"];

mkdirSync(path.join(outDir, "dpa"), { recursive: true });

// 1. Skill source, verbatim
for (const f of SKILL_FILES) {
  copyFileSync(path.join(SKILL_DIR, f), path.join(outDir, "dpa", f));
}

// 2. Derived texts — enumerate every variant through the real builders
const LANGS = ["en", "es"] as const;
const transferAddendaSections: Record<string, Record<string, string>> = {};
for (const uk of ["yes", "no"]) {
  for (const swiss of ["yes", "no"]) {
    const key = `uk-${uk}_swiss-${swiss}`;
    transferAddendaSections[key] = {};
    for (const lang of LANGS) {
      transferAddendaSections[key][lang] = buildTransferAddendaSections(
        { "include-uk-addendum": uk, "include-swiss-adaptations": swiss },
        lang
      );
    }
  }
}

const importerStatements: Record<string, Record<string, Record<string, string>>> = {
  ecsp: {},
  requestHistory: {},
  breachHistory: {},
};
for (const v of ["yes", "no", "unknown"]) {
  importerStatements.ecsp[v] = {};
  for (const lang of LANGS) {
    importerStatements.ecsp[v][lang] = buildTiaImporterStatements(
      { "tia-importer-hosted": v },
      lang
    ).tiaEcspStatement;
  }
}
for (const v of ["none", "some", "unknown"]) {
  importerStatements.requestHistory[v] = {};
  importerStatements.breachHistory[v] = {};
  for (const lang of LANGS) {
    const built = buildTiaImporterStatements(
      { "tia-gov-requests-received": v, "tia-breach-history": v },
      lang
    );
    importerStatements.requestHistory[v][lang] = built.tiaRequestHistoryStatement;
    importerStatements.breachHistory[v][lang] = built.tiaBreachHistoryStatement;
  }
}

writeFileSync(
  path.join(outDir, "derived-texts.json"),
  JSON.stringify(
    {
      schema: "dealroom.derived-texts/1",
      derived: DERIVED_TEXTS,
      transferAddendaSections,
      importerStatements,
      tokenTranslations: TOKEN_TRANSLATIONS,
    },
    null,
    2
  ) + "\n"
);

// 3. Manifest
const sha256 = (p: string) =>
  createHash("sha256").update(readFileSync(p)).digest("hex");
const files: Record<string, string> = {};
for (const f of SKILL_FILES) files[`dpa/${f}`] = sha256(path.join(outDir, "dpa", f));
files["derived-texts.json"] = sha256(path.join(outDir, "derived-texts.json"));

let sourceCommit = "unknown";
try {
  sourceCommit = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
} catch {
  /* not a git checkout */
}

writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify(
    {
      schema: "dealroom.contract-pack/1",
      contractType: "DPA",
      sourceRepo: "RINDOGATAN/deal-room",
      sourceCommit,
      files,
    },
    null,
    2
  ) + "\n"
);

console.log(`✓ contract pack exported to ${outDir} (source ${sourceCommit.slice(0, 7)})`);
