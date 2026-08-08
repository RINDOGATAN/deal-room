#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Skill-content static guard.
 *
 * Walks SKILLS_DIR (default ./skills) and validates each skill's JSON
 * shape against the contract Dealroom expects at seed time. Catches
 * the most common authoring mistakes:
 *   - missing required files
 *   - invalid JSON
 *   - i18n strings missing a declared language
 *   - leftover [BRACKET] placeholders in boilerplate
 *   - LABEL-style [BRACKET] tokens in clause text that no parameter
 *     declares (language-aware: a localised spelling such as [IMPORTE]
 *     is accepted in Spanish text when `amount` is declared, because
 *     interpolateParameters resolves it through TOKEN_TRANSLATIONS)
 *   - {curly} boilerplate variables that aren't system-provided or
 *     bridged via a parameter's `boilerplateVariable`
 *
 * Exits non-zero on any error. Warnings are surfaced but do not fail
 * the run. Designed to also work against the legalskills repo —
 * just point SKILLS_DIR at it.
 *
 * Run: SKILLS_DIR=./skills node scripts/check-skills.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILLS_DIR = process.env.SKILLS_DIR
  ? process.env.SKILLS_DIR
  : fileURLToPath(new URL("../skills", import.meta.url));

const REQUIRED_FILES = ["clauses.json", "metadata.json", "boilerplate.json"];

// Curly variables that the document generator injects from deal/party state —
// never need to be declared in parameters.json.
// Source of truth: src/server/services/document/generator.ts:349-361
const SYSTEM_BOILERPLATE_VARS = new Set([
  "effectiveDate",
  "governingLaw",
  "partyAName",
  "partyBName",
  "partyAAddress",
  "partyBAddress",
  "partyAId",
  "partyBId",
  "partyAShortName",
  "partyBShortName",
  "partyASignatureBlock",
  "partyBSignatureBlock",
  // DPA international-transfer variables, derived by the generator from the
  // processor-establishment / DPF / TIA parameters (see the transfer block in
  // src/server/services/document/generator.ts) rather than mapped 1:1 from a
  // single parameter's boilerplateVariable.
  "processorEstablishmentDisplay",
  "dpfStatement",
  "tiaSafeguardsList",
  "tiaConclusion",
  "transferAddendaSections",
]);

// Superset of the GoverningLaw enum: skill tags may be more specific (e.g.
// DELAWARE). Keep in sync with SKILL_JURISDICTION_TO_GOVERNING_LAW in
// src/lib/jurisdictions.ts, which maps tags onto the deal engine's enum.
const VALID_JURISDICTIONS = new Set(["CALIFORNIA", "DELAWARE", "ENGLAND_WALES", "NEW_YORK", "SPAIN"]);

// ── Token translations (mirrors the runtime) ──────────────────────────────
//
// interpolateParameters() in src/lib/parameters.ts does NOT only look for the
// English token declared in parameters.json. When rendering a non-English
// contract it first maps that token through TOKEN_TRANSLATIONS and searches
// for the LOCALISED spelling (case-insensitively), then also for the English
// one. So `[IMPORTE]` in Spanish legal text is filled correctly whenever the
// skill declares the `amount` parameter — it is not a leak.
//
// The map is parsed out of parameters.ts rather than duplicated here so there
// is one source of truth. Parsing is deliberately strict: if the shape ever
// changes and we recover nothing, we abort instead of silently reverting to
// the old over-strict behaviour and failing valid Spanish content.
const PARAMETERS_TS = fileURLToPath(new URL("../src/lib/parameters.ts", import.meta.url));

function loadTokenTranslations() {
  // lang -> Map<localised token (lower), English base token (lower)>
  const byLang = new Map();
  let source;
  try {
    source = readFileSync(PARAMETERS_TS, "utf8");
  } catch {
    console.error(`✖ check:skills: cannot read ${PARAMETERS_TS} for TOKEN_TRANSLATIONS.`);
    process.exit(2);
  }

  const start = source.indexOf("const TOKEN_TRANSLATIONS");
  const end = start === -1 ? -1 : source.indexOf("\n};", start);
  if (start === -1 || end === -1) {
    console.error(
      "✖ check:skills: could not locate the TOKEN_TRANSLATIONS map in src/lib/parameters.ts.\n" +
        "  The guard needs it to tell localised tokens from real leaks. Update the parser.",
    );
    process.exit(2);
  }

  // Entries look like:  amount: { es: "importe" },   "start date": { es: "fecha de inicio" },
  const entryRe = /(?:"([^"\n]+)"|([A-Za-z_$][\w$]*))\s*:\s*\{([^}]*)\}/g;
  const langRe = /([a-z]{2}(?:-[A-Z]{2})?)\s*:\s*"([^"]+)"/g;
  for (const m of source.slice(start, end).matchAll(entryRe)) {
    const base = (m[1] ?? m[2] ?? "").toLowerCase();
    if (!base) continue;
    for (const t of m[3].matchAll(langRe)) {
      const lang = t[1];
      if (!byLang.has(lang)) byLang.set(lang, new Map());
      byLang.get(lang).set(t[2].toLowerCase(), base);
    }
  }

  if (byLang.size === 0) {
    console.error(
      "✖ check:skills: parsed TOKEN_TRANSLATIONS but found no entries.\n" +
        "  Refusing to run — this would flag every valid localised token as a leak.",
    );
    process.exit(2);
  }
  return byLang;
}

const TRANSLATIONS_BY_LANG = loadTokenTranslations();

/**
 * Language a walked string is written in, inferred from its path.
 *
 * i18n values sit under a language key ("…legalText.es"), so the trailing
 * segment identifies the rendering language. A string with no language suffix
 * gets no language: it is used verbatim for every contract language, so only
 * the English token is guaranteed to interpolate and we stay strict.
 */
function langOfPath(path) {
  const last = path.split(".").pop() ?? "";
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(last) ? last : null;
}

let errors = 0;
let warnings = 0;

function logError(skill, file, msg) {
  errors++;
  console.error(`✖ ${skill}/${file}: ${msg}`);
}
function logWarn(skill, file, msg) {
  warnings++;
  console.warn(`⚠ ${skill}/${file}: ${msg}`);
}

function parseJson(skill, file, path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    logError(skill, file, `invalid JSON: ${e.message}`);
    return null;
  }
}

/**
 * Recursively walk an object/array. Calls visitor on every value with
 * the path that led to it (e.g. "clauses[0].title").
 */
function walkValues(node, path, visitor) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkValues(v, `${path}[${i}]`, visitor));
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      walkValues(v, path ? `${path}.${k}` : k, visitor);
    }
    return;
  }
  visitor(node, path);
}

/**
 * Detect i18n objects: plain objects whose keys look like language codes
 * (en, es, fr, de) and whose values are all strings.
 */
function isI18nObject(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  const keys = Object.keys(node);
  if (keys.length === 0) return false;
  if (!keys.every((k) => /^[a-z]{2}(-[A-Z]{2})?$/.test(k))) return false;
  return Object.values(node).every((v) => typeof v === "string");
}

function walkI18nObjects(node, path, visitor) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkI18nObjects(v, `${path}[${i}]`, visitor));
    return;
  }
  if (typeof node !== "object") return;
  if (isI18nObject(node)) {
    visitor(node, path);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    walkI18nObjects(v, path ? `${path}.${k}` : k, visitor);
  }
}

// ── Rules ─────────────────────────────────────────────────────────────────

function checkRequiredFiles(skill, dir) {
  for (const f of REQUIRED_FILES) {
    if (!existsSync(join(dir, f))) {
      logError(skill, f, `required file is missing`);
    }
  }
}

function checkI18nCompleteness(skill, file, doc, languages) {
  walkI18nObjects(doc, "", (obj, path) => {
    for (const lang of languages) {
      if (!(lang in obj)) {
        logError(
          skill,
          file,
          `${path || "<root>"}: missing language "${lang}" (has: ${Object.keys(obj).join(", ")})`,
        );
      }
    }
  });
}

function checkBracketLeaks(skill, file, doc) {
  // Boilerplate should not contain ANY bracket placeholders — clauses are
  // the place for them. Catches all-caps ([PARTY_NAME]), mixed-case
  // ([Party Name]) and lower-case ([amount]) tokens alike: any bracketed
  // run containing a letter.
  const re = /\[([^\[\]\n]*[A-Za-z][^\[\]\n]*)\]/g;
  walkValues(doc, "", (val, path) => {
    if (typeof val !== "string") return;
    const matches = val.match(re);
    if (matches) {
      logError(
        skill,
        file,
        `${path}: leftover bracket placeholder(s): ${[...new Set(matches)].join(", ")}`,
      );
    }
  });
}

function checkClauseTokenLeaks(skill, clauses, parameters) {
  // Bracket tokens in CLAUSE legal text are legitimate in these forms:
  //   1. lower-case / sentence-case fill-ins and drafter notes the author
  //      wrote deliberately (e.g. [amount], [as listed in Annex 1],
  //      [No non-solicitation provision included]);
  //   2. slash-separated pick-one blanks (e.g. [EEA/United Kingdom/United
  //      States]);
  //   3. tokens declared in parameters.json (matched case-insensitively by
  //      src/lib/parameters.ts interpolateParameters, e.g. [DPO email]);
  //   4. the LOCALISED spelling of a declared token, inside a string written
  //      in that language (e.g. [IMPORTE] in `legalText.es` when the skill
  //      declares `amount` — interpolateParameters maps it through
  //      TOKEN_TRANSLATIONS before searching). Language matters: the same
  //      [IMPORTE] sitting in `legalText.en` really would ship verbatim.
  // What is NOT legitimate: undeclared LABEL-style tokens — ALL-CAPS
  // leftovers like [NAMED COMPETITORS] or Title-Case strays like
  // [Company Name] — which would ship verbatim in a finished document.
  if (!clauses) return;
  const declaredTokens = new Set(
    (parameters?.parameters ?? [])
      .map((p) => (typeof p.token === "string" ? p.token.toLowerCase() : null))
      .filter(Boolean),
  );
  const isLeakToken = (token) => {
    if (token.includes("/")) return false; // pick-one blank
    const words = token.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
    if (words.length === 0) return false;
    if (!/[a-z]/.test(token)) return true; // ALL-CAPS label
    return words.every((w) => /^[A-Z]/.test(w)); // Title-Case label
  };
  const re = /\[([^\[\]\n]*[A-Za-z][^\[\]\n]*)\]/g;
  walkValues(clauses, "", (val, path) => {
    if (typeof val !== "string") return;
    const lang = langOfPath(path);
    // Localised spellings only resolve when the text is rendered in that
    // language, so only consult the map for non-English strings.
    const localised =
      lang && lang !== "en" ? TRANSLATIONS_BY_LANG.get(lang) : undefined;
    let m;
    const leaks = new Set();
    const undeclaredBases = new Map(); // "[IMPORTE]" -> "amount"
    while ((m = re.exec(val)) !== null) {
      const token = m[1];
      const lower = token.toLowerCase();
      if (declaredTokens.has(lower)) continue; // parameter token
      if (!isLeakToken(token)) continue;
      const base = localised?.get(lower);
      if (base) {
        // A known localised spelling. Fine if its English base is declared;
        // otherwise it is a leak, but a much more specific one — say so.
        if (declaredTokens.has(base)) continue;
        undeclaredBases.set(`[${token}]`, base);
        continue;
      }
      leaks.add(`[${token}]`);
    }
    if (leaks.size > 0) {
      logError(
        skill,
        "clauses.json",
        `${path}: leaked placeholder token(s) not declared in parameters.json: ${[...leaks].join(", ")}`,
      );
    }
    for (const [token, base] of undeclaredBases) {
      logError(
        skill,
        "clauses.json",
        `${path}: ${token} is the "${lang}" spelling of "${base}", but "${base}" is not declared in parameters.json — it will ship verbatim`,
      );
    }
  });
}

function checkBoilerplateVars(skill, boilerplate, parameters) {
  const declared = new Set();
  if (parameters && Array.isArray(parameters.parameters)) {
    for (const p of parameters.parameters) {
      if (p.boilerplateVariable) declared.add(p.boilerplateVariable);
    }
  }
  const re = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
  const seen = new Set();
  walkValues(boilerplate, "", (val, path) => {
    if (typeof val !== "string") return;
    let m;
    while ((m = re.exec(val)) !== null) {
      const name = m[1];
      if (SYSTEM_BOILERPLATE_VARS.has(name)) continue;
      if (declared.has(name)) continue;
      const key = `${path}::${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      logError(
        skill,
        "boilerplate.json",
        `${path}: unknown {${name}} — not a system var and not declared as boilerplateVariable in parameters.json`,
      );
    }
  });
}

function checkMetadataSanity(skill, metadata, clauses) {
  if (!metadata) return;
  if (metadata.contractType && clauses?.contractType && metadata.contractType !== clauses.contractType) {
    logError(skill, "metadata.json", `contractType mismatch: metadata=${metadata.contractType} vs clauses=${clauses.contractType}`);
  }
  if (Array.isArray(metadata.jurisdictions)) {
    for (const j of metadata.jurisdictions) {
      if (!VALID_JURISDICTIONS.has(j)) {
        logError(skill, "metadata.json", `invalid jurisdiction "${j}" (allowed: ${[...VALID_JURISDICTIONS].join(", ")})`);
      }
    }
  }
  if (typeof metadata.clauseCount === "number" && Array.isArray(clauses?.clauses)) {
    if (metadata.clauseCount !== clauses.clauses.length) {
      logWarn(
        skill,
        "metadata.json",
        `clauseCount=${metadata.clauseCount} but clauses.json has ${clauses.clauses.length}`,
      );
    }
  }
}

function checkClauseBiases(skill, clauses) {
  if (!clauses?.clauses) return;
  for (const [ci, clause] of clauses.clauses.entries()) {
    if (!Array.isArray(clause.options)) continue;
    for (const [oi, option] of clause.options.entries()) {
      const hasA = typeof option.biasPartyA === "number";
      const hasB = typeof option.biasPartyB === "number";
      if (!hasA || !hasB) {
        logWarn(
          skill,
          "clauses.json",
          `clauses[${ci}].options[${oi}] (id=${option.id ?? "?"}): missing ${!hasA ? "biasPartyA" : ""}${!hasA && !hasB ? "+" : ""}${!hasB ? "biasPartyB" : ""} — seed will default to 0 but explicit is safer`,
        );
      }
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

function listSkills(dir) {
  if (!existsSync(dir)) {
    console.error(`✖ SKILLS_DIR does not exist: ${dir}`);
    process.exit(2);
  }
  return readdirSync(dir)
    .filter((entry) => {
      // Skip scaffolding/hidden dirs (e.g. `_template`, `.git`). The
      // seed loader applies the same filter, so the static guard
      // matches its scope.
      if (entry.startsWith("_") || entry.startsWith(".")) return false;
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) return false;
      // A skill dir is one the seeder would load: prisma/seed.ts skips any
      // dir without clauses.json, so the guard scopes the same way. Catalog
      // /document-only skills (metadata + parameters, no clauses — e.g.
      // legalskills' dpia-companion) are storefront data, not seedable
      // negotiation templates, and must not be flagged here.
      return existsSync(join(full, "clauses.json"));
    })
    .sort();
}

const skills = listSkills(SKILLS_DIR);
console.log(`Checking ${skills.length} skill(s) in ${SKILLS_DIR}\n`);

for (const skill of skills) {
  const dir = join(SKILLS_DIR, skill);
  checkRequiredFiles(skill, dir);

  const metadata = parseJson(skill, "metadata.json", join(dir, "metadata.json"));
  const clauses = parseJson(skill, "clauses.json", join(dir, "clauses.json"));
  const boilerplate = parseJson(skill, "boilerplate.json", join(dir, "boilerplate.json"));
  const parametersPath = join(dir, "parameters.json");
  const parameters = existsSync(parametersPath)
    ? parseJson(skill, "parameters.json", parametersPath)
    : null;

  const languages =
    metadata && Array.isArray(metadata.languages) ? metadata.languages : ["en"];

  if (metadata) checkI18nCompleteness(skill, "metadata.json", metadata, languages);
  if (clauses) checkI18nCompleteness(skill, "clauses.json", clauses, languages);
  if (boilerplate) checkI18nCompleteness(skill, "boilerplate.json", boilerplate, languages);
  if (parameters) checkI18nCompleteness(skill, "parameters.json", parameters, languages);

  if (boilerplate) checkBracketLeaks(skill, "boilerplate.json", boilerplate);
  if (boilerplate) checkBoilerplateVars(skill, boilerplate, parameters);
  checkClauseTokenLeaks(skill, clauses, parameters);

  checkMetadataSanity(skill, metadata, clauses);
  checkClauseBiases(skill, clauses);
}

console.log("");
if (errors > 0) {
  console.error(`✖ ${errors} error(s), ${warnings} warning(s) across ${skills.length} skill(s).`);
  process.exit(1);
}
if (warnings > 0) {
  console.log(`⚠ ${warnings} warning(s) across ${skills.length} skill(s) — non-blocking.`);
} else {
  console.log(`✓ Checked ${skills.length} skill(s) — no issues.`);
}
