#!/usr/bin/env node
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

const SKILLS_DIR = process.env.SKILLS_DIR
  ? process.env.SKILLS_DIR
  : new URL("../skills", import.meta.url).pathname;

const REQUIRED_FILES = ["clauses.json", "metadata.json", "boilerplate.json"];

// Curly variables that the document generator injects from deal/party state —
// never need to be declared in parameters.json.
// Source of truth: src/server/services/document/generator.ts:349-361
const SYSTEM_BOILERPLATE_VARS = new Set([
  "effectiveDate",
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
]);

const VALID_JURISDICTIONS = new Set(["CALIFORNIA", "ENGLAND_WALES", "SPAIN"]);

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
  // Leftover all-caps placeholders like [PARTY_NAME], [JURISDICTION], etc.
  // Real bracket-tokens in CLAUSE legal text use lower-case (e.g. [amount],
  // [start date]). Boilerplate should not contain ANY brackets — clauses
  // are the place for them.
  const re = /\[([A-Z][A-Z0-9 _-]{1,40})\]/g;
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
      // Heuristic: a skill dir contains at least one of the required files.
      return REQUIRED_FILES.some((f) => existsSync(join(full, f)));
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
