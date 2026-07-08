// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Validates that all bilingual skills resolve correctly in both English and Spanish.
 * Tests i18n resolution and checks for language bleed-through.
 *
 * Usage: npx tsx scripts/validate-i18n.ts
 */

import * as fs from "fs";
import * as path from "path";
import { resolveLocalizedString, resolveLocalizedArray } from "../src/server/services/skills/i18n";

const SKILLS_DIR = path.join(process.cwd(), "skills");

const BILINGUAL_SKILLS = ["nda", "saas", "msa", "dpa", "privacy-notice"];
const SPANISH_ONLY_SKILLS: string[] = [];  // Premium Spanish skills now in legalskills repo

let totalChecks = 0;
let totalPassed = 0;
let totalFailed = 0;
const failures: string[] = [];

function check(desc: string, condition: boolean) {
  totalChecks++;
  if (condition) {
    totalPassed++;
  } else {
    totalFailed++;
    failures.push(desc);
    console.log(`  FAIL: ${desc}`);
  }
}

function isLocalized(val: unknown): val is Record<string, string> {
  return typeof val === "object" && val !== null && !Array.isArray(val) && "en" in val;
}

function isLocalizedArray(val: unknown): val is Record<string, string[]> {
  return typeof val === "object" && val !== null && !Array.isArray(val) && "en" in val;
}

function looksEnglish(text: string): boolean {
  const engMarkers = /\b(the|shall|means|including|pursuant|whereas|hereby|thereof|herein|notwithstanding)\b/i;
  return engMarkers.test(text);
}

function validateClausesFile(skillName: string, lang: "en" | "es") {
  const filePath = path.join(SKILLS_DIR, skillName, "clauses.json");
  if (!fs.existsSync(filePath)) return;

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const clauses = data.clauses || [];

  if (isLocalized(data.displayName)) {
    const resolved = resolveLocalizedString(data.displayName, lang);
    check(`${skillName}/clauses displayName [${lang}] resolves`, resolved.length > 0);
    if (lang === "es") check(`${skillName}/clauses displayName [es] not English`, !looksEnglish(resolved));
  }

  for (const clause of clauses) {
    const clauseId = clause.id;

    if (isLocalized(clause.title)) {
      const t = resolveLocalizedString(clause.title, lang);
      check(`${skillName}/${clauseId} title [${lang}] resolves`, t.length > 0);
      if (lang === "es") check(`${skillName}/${clauseId} title [es] not English`, !looksEnglish(t));
    } else if (lang === "es" && BILINGUAL_SKILLS.includes(skillName)) {
      check(`${skillName}/${clauseId} title should be i18n object`, false);
    }

    if (isLocalized(clause.category)) {
      const c = resolveLocalizedString(clause.category, lang);
      check(`${skillName}/${clauseId} category [${lang}] resolves`, c.length > 0);
    }

    if (isLocalized(clause.plainDescription)) {
      const d = resolveLocalizedString(clause.plainDescription, lang);
      check(`${skillName}/${clauseId} plainDescription [${lang}] resolves`, d.length > 0);
    }

    const options = clause.options || [];
    for (const opt of options) {
      const optId = opt.id;

      if (isLocalized(opt.label)) {
        const l = resolveLocalizedString(opt.label, lang);
        check(`${skillName}/${clauseId}/${optId} label [${lang}] resolves`, l.length > 0);
      }

      if (isLocalized(opt.legalText)) {
        const lt = resolveLocalizedString(opt.legalText, lang);
        check(`${skillName}/${clauseId}/${optId} legalText [${lang}] resolves`, lt.length > 0);
        if (lang === "es") check(`${skillName}/${clauseId}/${optId} legalText [es] not English`, !looksEnglish(lt));
      }

      if (opt.pros && typeof opt.pros === "object") {
        if (opt.pros.partyA && isLocalizedArray(opt.pros.partyA)) {
          const arr = resolveLocalizedArray(opt.pros.partyA, lang);
          check(`${skillName}/${clauseId}/${optId} pros.partyA [${lang}] resolves`, arr.length > 0);
        }
      }
    }
  }
}

function validateBoilerplateFile(skillName: string, lang: "en" | "es") {
  const filePath = path.join(SKILLS_DIR, skillName, "boilerplate.json");
  if (!fs.existsSync(filePath)) return;

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if (isLocalized(data.contractTitle)) {
    const t = resolveLocalizedString(data.contractTitle, lang);
    check(`${skillName}/boilerplate contractTitle [${lang}] resolves`, t.length > 0);
    if (lang === "es") check(`${skillName}/boilerplate contractTitle [es] not English`, !looksEnglish(t));
  } else if (typeof data.contractTitle === "string" && BILINGUAL_SKILLS.includes(skillName)) {
    check(`${skillName}/boilerplate contractTitle should be i18n`, false);
  }

  if (isLocalized(data.preamble)) {
    const p = resolveLocalizedString(data.preamble, lang);
    check(`${skillName}/boilerplate preamble [${lang}] resolves`, p.length > 0);
  }

  if (Array.isArray(data.definitions)) {
    for (let i = 0; i < data.definitions.length; i++) {
      const def = data.definitions[i];
      if (isLocalized(def.term)) {
        check(`${skillName}/boilerplate def[${i}].term [${lang}] resolves`, resolveLocalizedString(def.term, lang).length > 0);
      }
      if (isLocalized(def.definition)) {
        check(`${skillName}/boilerplate def[${i}].definition [${lang}] resolves`, resolveLocalizedString(def.definition, lang).length > 0);
      }
    }
  }

  if (Array.isArray(data.standardClauses)) {
    for (let i = 0; i < data.standardClauses.length; i++) {
      const sc = data.standardClauses[i];
      if (isLocalized(sc.title)) {
        check(`${skillName}/boilerplate stdClause[${i}].title [${lang}] resolves`, resolveLocalizedString(sc.title, lang).length > 0);
      }
      if (isLocalized(sc.text)) {
        const t = resolveLocalizedString(sc.text, lang);
        check(`${skillName}/boilerplate stdClause[${i}].text [${lang}] resolves`, t.length > 0);
        if (lang === "es") check(`${skillName}/boilerplate stdClause[${i}].text [es] not English`, !looksEnglish(t));
      }
    }
  }

  if (data.jurisdictionProvisions) {
    for (const [jur, prov] of Object.entries(data.jurisdictionProvisions)) {
      const p = prov as Record<string, unknown>;
      if (isLocalized(p.title)) {
        check(`${skillName}/boilerplate jurProv[${jur}].title [${lang}] resolves`, resolveLocalizedString(p.title, lang).length > 0);
      }
      if (isLocalized(p.text)) {
        check(`${skillName}/boilerplate jurProv[${jur}].text [${lang}] resolves`, resolveLocalizedString(p.text, lang).length > 0);
      }
    }
  }

  if (data.partyLabels) {
    if (isLocalized(data.partyLabels.partyA)) {
      check(`${skillName}/boilerplate partyLabels.partyA [${lang}] resolves`, resolveLocalizedString(data.partyLabels.partyA, lang).length > 0);
    }
    if (isLocalized(data.partyLabels.partyB)) {
      check(`${skillName}/boilerplate partyLabels.partyB [${lang}] resolves`, resolveLocalizedString(data.partyLabels.partyB, lang).length > 0);
    }
  }
}

function validateMetadataFile(skillName: string, lang: "en" | "es") {
  const filePath = path.join(SKILLS_DIR, skillName, "metadata.json");
  if (!fs.existsSync(filePath)) return;

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if (isLocalized(data.displayName)) {
    check(`${skillName}/metadata displayName [${lang}] resolves`, resolveLocalizedString(data.displayName, lang).length > 0);
  } else if (BILINGUAL_SKILLS.includes(skillName)) {
    check(`${skillName}/metadata displayName should be i18n`, false);
  }

  if (data.description && isLocalized(data.description)) {
    check(`${skillName}/metadata description [${lang}] resolves`, resolveLocalizedString(data.description, lang).length > 0);
  }
}

console.log("=== Spanish Language Validation ===\n");

for (const skill of BILINGUAL_SKILLS) {
  console.log(`\nBilingual: ${skill}`);
  for (const lang of ["en", "es"] as const) {
    validateClausesFile(skill, lang);
    validateBoilerplateFile(skill, lang);
    validateMetadataFile(skill, lang);
  }
}

for (const skill of SPANISH_ONLY_SKILLS) {
  console.log(`\nSpanish-only: ${skill}`);
  validateClausesFile(skill, "es");
  validateBoilerplateFile(skill, "es");
  validateMetadataFile(skill, "es");
}

console.log(`\n=== Results ===`);
console.log(`Total checks: ${totalChecks}`);
console.log(`Passed: ${totalPassed}`);
console.log(`Failed: ${totalFailed}`);

if (failures.length > 0) {
  console.log(`\n=== Failures ===`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log(`\nAll checks passed!`);
}
