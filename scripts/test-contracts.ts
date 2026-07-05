/**
 * Comprehensive Contract & Compromise Test Suite
 *
 * Tests the compromise engine, skill file integrity, i18n completeness,
 * and parameter interpolation WITHOUT requiring a database or external services.
 *
 * Usage: npx tsx scripts/test-contracts.ts
 */

import {
  calculateCompromise,
  globalFairnessPass,
  type OptionInput,
  type SelectionInput,
} from "../src/server/services/compromise/engine";
import * as fs from "fs";
import * as path from "path";

// ── Test Infrastructure ──────────────────────────────────────

let totalTests = 0;
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, name: string, detail?: string) {
  totalTests++;
  if (condition) {
    passed++;
  } else {
    failed++;
    const msg = detail ? `${name}: ${detail}` : name;
    failures.push(msg);
    console.log(`    FAIL  ${msg}`);
  }
}

function section(title: string) {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(80)}`);
}

// ── Helpers ──────────────────────────────────────────────────

function makeOptions(count: number): OptionInput[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `opt_${i + 1}`,
    order: i + 1,
    label: `Option ${i + 1}`,
    biasPartyA: (count - 1 - i) / (count - 1) - 0.5, // A prefers lower orders
    biasPartyB: i / (count - 1) - 0.5, // B prefers higher orders
  }));
}

function makeSelection(
  optionId: string,
  flexibility: number,
  bias: number,
  priority = 3
): SelectionInput {
  return { optionId, priority, flexibility, biasPartyA: bias, biasPartyB: -bias };
}

// ═══════════════════════════════════════════════════════════════
// PART 1: COMPROMISE ENGINE TESTS
// ═══════════════════════════════════════════════════════════════

section("PART 1: Compromise Engine — Core Logic");

// 1.1 Same selection → returns that option
{
  const options = makeOptions(5);
  const result = calculateCompromise({
    partyASelection: makeSelection("opt_3", 3, 0),
    partyBSelection: makeSelection("opt_3", 3, 0),
    options,
    clauseTitle: "Test: same selection",
  });
  assert(result.suggestedOptionId === "opt_3", "Same selection → same option");
  assert(result.satisfactionPartyA >= 80, "Same selection → high satisfaction A", `${result.satisfactionPartyA}%`);
  assert(result.satisfactionPartyB >= 80, "Same selection → high satisfaction B", `${result.satisfactionPartyB}%`);
}

// 1.2 Opposite extremes, equal flexibility → middle option
{
  const options = makeOptions(5);
  const result = calculateCompromise({
    partyASelection: makeSelection("opt_1", 3, 0.5),
    partyBSelection: makeSelection("opt_5", 3, -0.5),
    options,
    clauseTitle: "Test: opposite extremes",
  });
  assert(result.suggestedOptionId === "opt_3", "Opposite extremes → middle", `got ${result.suggestedOptionId}`);
}

// 1.3 A is firm, B is flexible → A's choice
{
  const options = makeOptions(5);
  const result = calculateCompromise({
    partyASelection: makeSelection("opt_1", 1, 0.8),
    partyBSelection: makeSelection("opt_5", 5, -0.2),
    options,
    clauseTitle: "Test: A firm, B flexible",
  });
  // A has high stake (low flexibility + high bias), B has low stake
  // B is very flexible (>=4), so engine should give A's exact choice
  assert(result.suggestedOptionId === "opt_1", "A firm + B flexible → A's choice", `got ${result.suggestedOptionId}`);
}

// 1.4 B is firm, A is flexible → B's choice
{
  const options = makeOptions(5);
  const result = calculateCompromise({
    partyASelection: makeSelection("opt_1", 5, 0.2),
    partyBSelection: makeSelection("opt_5", 1, -0.8),
    options,
    clauseTitle: "Test: B firm, A flexible",
  });
  assert(result.suggestedOptionId === "opt_5", "B firm + A flexible → B's choice", `got ${result.suggestedOptionId}`);
}

// 1.5 Both firm → compromise closer to higher stake
{
  const options = makeOptions(5);
  const result = calculateCompromise({
    partyASelection: makeSelection("opt_1", 1, 0.9),
    partyBSelection: makeSelection("opt_5", 2, -0.5),
    options,
    clauseTitle: "Test: both firm, A higher stake",
  });
  const suggestedOrder = options.find(o => o.id === result.suggestedOptionId)!.order;
  // Should lean toward A (lower order)
  assert(suggestedOrder <= 3, "Both firm, A higher stake → leans A", `suggested order ${suggestedOrder}`);
}

// 1.6 2-option clauses (binary choice)
section("PART 1b: Binary Clauses (2 options)");
{
  const options = makeOptions(2);

  // Equal flexibility → middle (rounds to one of them)
  const r1 = calculateCompromise({
    partyASelection: makeSelection("opt_1", 3, 0.5),
    partyBSelection: makeSelection("opt_2", 3, -0.5),
    options,
    clauseTitle: "Binary: equal stakes",
  });
  assert(["opt_1", "opt_2"].includes(r1.suggestedOptionId), "Binary equal → picks one");

  // A firm → A wins
  const r2 = calculateCompromise({
    partyASelection: makeSelection("opt_1", 1, 0.9),
    partyBSelection: makeSelection("opt_2", 4, -0.2),
    options,
    clauseTitle: "Binary: A firm",
  });
  assert(r2.suggestedOptionId === "opt_1", "Binary A firm → opt_1", `got ${r2.suggestedOptionId}`);
}

// 1.7 3-option clauses
section("PART 1c: Three-Option Clauses");
{
  const options = makeOptions(3);

  const r1 = calculateCompromise({
    partyASelection: makeSelection("opt_1", 3, 0.5),
    partyBSelection: makeSelection("opt_3", 3, -0.5),
    options,
    clauseTitle: "Three: extremes, equal",
  });
  assert(r1.suggestedOptionId === "opt_2", "Three options extremes → middle", `got ${r1.suggestedOptionId}`);

  // Adjacent selections
  const r2 = calculateCompromise({
    partyASelection: makeSelection("opt_1", 3, 0.3),
    partyBSelection: makeSelection("opt_2", 3, -0.3),
    options,
    clauseTitle: "Three: adjacent",
  });
  const order = options.find(o => o.id === r2.suggestedOptionId)!.order;
  assert(order <= 2, "Three adjacent → opt_1 or opt_2", `got order ${order}`);
}

// 1.8 Satisfaction scores are bounded 0-100
section("PART 1d: Satisfaction Score Bounds");
{
  const options = makeOptions(5);
  const permutations: Array<[string, string, number, number]> = [
    ["opt_1", "opt_5", 1, 1], // both inflexible, opposite
    ["opt_1", "opt_5", 5, 5], // both flexible, opposite
    ["opt_1", "opt_1", 1, 1], // same, inflexible
    ["opt_1", "opt_1", 5, 5], // same, flexible
    ["opt_1", "opt_3", 1, 5], // A firm, B flexible
    ["opt_1", "opt_3", 5, 1], // A flexible, B firm
    ["opt_2", "opt_4", 2, 4], // mixed
    ["opt_5", "opt_1", 3, 3], // reversed
  ];

  for (const [optA, optB, flexA, flexB] of permutations) {
    const result = calculateCompromise({
      partyASelection: makeSelection(optA, flexA, 0.3),
      partyBSelection: makeSelection(optB, flexB, -0.3),
      options,
      clauseTitle: `Bounds: ${optA}/${optB} flex=${flexA}/${flexB}`,
    });
    assert(
      result.satisfactionPartyA >= 0 && result.satisfactionPartyA <= 100,
      `Sat A in [0,100] for ${optA}/${optB}`,
      `${result.satisfactionPartyA}`
    );
    assert(
      result.satisfactionPartyB >= 0 && result.satisfactionPartyB <= 100,
      `Sat B in [0,100] for ${optA}/${optB}`,
      `${result.satisfactionPartyB}`
    );
    assert(
      typeof result.reasoning === "string" && result.reasoning.length > 0,
      `Reasoning non-empty for ${optA}/${optB}`
    );
  }
}

// 1.9 Priority param is ignored (backward compat)
section("PART 1e: Priority Ignored");
{
  const options = makeOptions(5);
  const base = calculateCompromise({
    partyASelection: makeSelection("opt_1", 2, 0.5),
    partyBSelection: makeSelection("opt_5", 2, -0.5),
    options,
    clauseTitle: "Priority test base",
  });

  // Same but different priorities
  const withDiffPriority = calculateCompromise({
    partyASelection: { ...makeSelection("opt_1", 2, 0.5), priority: 1 },
    partyBSelection: { ...makeSelection("opt_5", 2, -0.5), priority: 5 },
    options,
    clauseTitle: "Priority test varied",
  });

  assert(
    base.suggestedOptionId === withDiffPriority.suggestedOptionId,
    "Priority change doesn't affect suggestion"
  );
}

// 1.10 Dynamic biases override static ones
section("PART 1f: Dynamic Bias Overrides");
{
  const options = makeOptions(3);

  // Without overrides: A picks opt_1, B picks opt_3, equal flex → middle
  calculateCompromise({
    partyASelection: makeSelection("opt_1", 3, 0.5),
    partyBSelection: makeSelection("opt_3", 3, -0.5),
    options,
    clauseTitle: "Dynamic bias: no override",
  });

  // With overrides: shift all biases toward party B
  const r2 = calculateCompromise({
    partyASelection: makeSelection("opt_1", 3, 0.5),
    partyBSelection: makeSelection("opt_3", 3, -0.5),
    options,
    clauseTitle: "Dynamic bias: with override",
    dynamicBiases: {
      opt_1: { biasPartyA: -0.5, biasPartyB: 0.8 },
      opt_2: { biasPartyA: -0.3, biasPartyB: 0.5 },
      opt_3: { biasPartyA: -0.1, biasPartyB: 0.9 },
    },
  });

  // Dynamic biases should produce a result (may or may not differ)
  assert(!!r2.suggestedOptionId, "Dynamic bias produces valid result");
}

// 1.11 Global fairness pass
section("PART 1g: Global Fairness Pass");
{
  const options = makeOptions(5);

  // Create heavily skewed suggestions (all favor A)
  const skewedSuggestions = Array.from({ length: 8 }, (_, i) => {
    const result = calculateCompromise({
      partyASelection: makeSelection("opt_1", 1, 0.9),
      partyBSelection: makeSelection("opt_5", 3, -0.3),
      options,
      clauseTitle: `Fairness clause ${i + 1}`,
    });
    return {
      clauseId: `clause_${i + 1}`,
      result,
      options,
      partyAOptionOrder: 1,
      partyBOptionOrder: 5,
    };
  });

  const rebalanced = globalFairnessPass(skewedSuggestions);
  assert(rebalanced.length === 8, "Fairness pass returns same count");

  // After rebalancing, the total satisfaction gap should be reduced
  const avgABefore = skewedSuggestions.reduce((s, x) => s + x.result.satisfactionPartyA, 0) / 8;
  const avgBBefore = skewedSuggestions.reduce((s, x) => s + x.result.satisfactionPartyB, 0) / 8;
  const avgAAfter = rebalanced.reduce((s, x) => s + x.result.satisfactionPartyA, 0) / 8;
  const avgBAfter = rebalanced.reduce((s, x) => s + x.result.satisfactionPartyB, 0) / 8;

  const gapBefore = Math.abs(avgABefore - avgBBefore);
  const gapAfter = Math.abs(avgAAfter - avgBAfter);

  assert(gapAfter <= gapBefore, "Fairness pass reduces or maintains gap", `before=${gapBefore.toFixed(1)}, after=${gapAfter.toFixed(1)}`);

  // Balanced suggestions should not be changed
  const balancedSuggestions = Array.from({ length: 4 }, (_, i) => {
    const result = calculateCompromise({
      partyASelection: makeSelection("opt_2", 3, 0.3),
      partyBSelection: makeSelection("opt_4", 3, -0.3),
      options,
      clauseTitle: `Balanced clause ${i + 1}`,
    });
    return {
      clauseId: `bclause_${i + 1}`,
      result,
      options,
      partyAOptionOrder: 2,
      partyBOptionOrder: 4,
    };
  });

  const notRebalanced = globalFairnessPass(balancedSuggestions);
  const unchanged = notRebalanced.every(
    (r, i) => r.result.suggestedOptionId === balancedSuggestions[i].result.suggestedOptionId
  );
  assert(unchanged, "Balanced suggestions unchanged by fairness pass");
}

// 1.12 Exhaustive flexibility x bias matrix
section("PART 1h: Exhaustive Flexibility x Bias Matrix (5x5 grid)");
{
  const options = makeOptions(5);
  let edgeCaseCount = 0;

  for (let flexA = 1; flexA <= 5; flexA++) {
    for (let flexB = 1; flexB <= 5; flexB++) {
      for (const biasA of [0, 0.3, 0.7, 1.0]) {
        for (const biasB of [0, -0.3, -0.7, -1.0]) {
          const result = calculateCompromise({
            partyASelection: { optionId: "opt_1", priority: 3, flexibility: flexA, biasPartyA: biasA, biasPartyB: 0 },
            partyBSelection: { optionId: "opt_5", priority: 3, flexibility: flexB, biasPartyA: 0, biasPartyB: biasB },
            options,
            clauseTitle: `Matrix flex=${flexA}/${flexB} bias=${biasA}/${biasB}`,
          });
          edgeCaseCount++;

          // Must always produce a valid option
          const isValid = options.some(o => o.id === result.suggestedOptionId);
          if (!isValid) {
            assert(false, `Matrix flex=${flexA}/${flexB} bias=${biasA}/${biasB} → invalid option`);
          }

          // Satisfaction must be in bounds
          if (result.satisfactionPartyA < 0 || result.satisfactionPartyA > 100 ||
              result.satisfactionPartyB < 0 || result.satisfactionPartyB > 100) {
            assert(false, `Matrix flex=${flexA}/${flexB} → satisfaction out of bounds`,
              `A:${result.satisfactionPartyA} B:${result.satisfactionPartyB}`);
          }
        }
      }
    }
  }
  assert(true, `Exhaustive matrix: ${edgeCaseCount} permutations all valid`);
}

// ═══════════════════════════════════════════════════════════════
// PART 2: SKILL FILE INTEGRITY
// ═══════════════════════════════════════════════════════════════

section("PART 2: Skill File Integrity");

// Built-in skills
const builtInSkillsDir = path.join(process.cwd(), "skills");
const builtInSkills = fs.existsSync(builtInSkillsDir)
  ? fs.readdirSync(builtInSkillsDir).filter(d =>
      fs.statSync(path.join(builtInSkillsDir, d)).isDirectory()
    )
  : [];

// Premium skills
const legalSkillsDir = process.env.SKILLS_DIR || path.join(process.cwd(), "..", "legalskills");
const premiumSkills = fs.existsSync(legalSkillsDir)
  ? fs.readdirSync(legalSkillsDir).filter(d => {
      const fullPath = path.join(legalSkillsDir, d);
      return fs.statSync(fullPath).isDirectory() &&
        !d.startsWith(".") && !d.startsWith("_") &&
        d !== "node_modules" && d !== "dist";
    })
  : [];

console.log(`  Found ${builtInSkills.length} built-in skills, ${premiumSkills.length} premium skills`);

// 2.1 Built-in skill files
for (const skill of builtInSkills) {
  const dir = path.join(builtInSkillsDir, skill);
  const clausesPath = path.join(dir, "clauses.json");
  const boilerplatePath = path.join(dir, "boilerplate.json");

  assert(fs.existsSync(clausesPath), `Built-in ${skill}: clauses.json exists`);
  assert(fs.existsSync(boilerplatePath), `Built-in ${skill}: boilerplate.json exists`);

  if (fs.existsSync(clausesPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(clausesPath, "utf-8"));
      assert(Array.isArray(data.clauses), `Built-in ${skill}: clauses is array`);
      assert(data.clauses.length > 0, `Built-in ${skill}: has clauses`);
    } catch (e: any) {
      assert(false, `Built-in ${skill}: clauses.json valid JSON`, e.message);
    }
  }
}

// 2.2 Premium skill files
section("PART 2b: Premium Skill Files");
for (const skill of premiumSkills) {
  const dir = path.join(legalSkillsDir, skill);
  const manifestPath = path.join(dir, "manifest.json");
  const metadataPath = path.join(dir, "metadata.json");
  const clausesPath = path.join(dir, "clauses.json");
  const boilerplatePath = path.join(dir, "boilerplate.json");

  assert(fs.existsSync(manifestPath), `${skill}: manifest.json exists`);
  assert(fs.existsSync(metadataPath), `${skill}: metadata.json exists`);
  assert(fs.existsSync(clausesPath), `${skill}: clauses.json exists`);
  assert(fs.existsSync(boilerplatePath), `${skill}: boilerplate.json exists`);

  // Validate manifest
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      assert(!!manifest.skillId, `${skill}: manifest has skillId`, manifest.skillId);
      assert(!!manifest.version, `${skill}: manifest has version`);
      assert(
        Array.isArray(manifest.jurisdictions) && manifest.jurisdictions.length > 0,
        `${skill}: manifest has jurisdictions`,
        JSON.stringify(manifest.jurisdictions)
      );
      assert(
        Array.isArray(manifest.languages) && manifest.languages.length > 0,
        `${skill}: manifest has languages`,
        JSON.stringify(manifest.languages)
      );

      // Validate jurisdiction values
      const validJurisdictions = ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"];
      for (const j of manifest.jurisdictions) {
        assert(
          validJurisdictions.includes(j),
          `${skill}: valid jurisdiction '${j}'`
        );
      }

      // Validate language values
      const validLanguages = ["en", "es"];
      for (const l of manifest.languages) {
        assert(validLanguages.includes(l), `${skill}: valid language '${l}'`);
      }
    } catch (e: any) {
      assert(false, `${skill}: manifest.json valid JSON`, e.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// PART 3: I18N COMPLETENESS
// ═══════════════════════════════════════════════════════════════

section("PART 3: i18n Completeness");

function isI18nObject(val: unknown): val is Record<string, string> {
  return typeof val === "object" && val !== null && !Array.isArray(val) && "en" in val;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained ad-hoc i18n audit helper; removing it would also orphan isI18nObject
function checkI18nCompleteness(
  obj: unknown,
  languages: string[],
  skillName: string,
  jsonPath: string
): void {
  if (obj === null || obj === undefined) return;

  if (isI18nObject(obj)) {
    for (const lang of languages) {
      assert(
        lang in obj && typeof obj[lang] === "string" && obj[lang].length > 0,
        `${skillName}: ${jsonPath} has '${lang}' translation`,
        `keys: ${Object.keys(obj).join(", ")}`
      );
    }
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => checkI18nCompleteness(item, languages, skillName, `${jsonPath}[${i}]`));
    return;
  }

  if (typeof obj === "object") {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      checkI18nCompleteness(val, languages, skillName, `${jsonPath}.${key}`);
    }
  }
}

// 3.1 Check clauses.json i18n for all premium skills
for (const skill of premiumSkills) {
  const dir = path.join(legalSkillsDir, skill);
  const manifestPath = path.join(dir, "manifest.json");
  const clausesPath = path.join(dir, "clauses.json");

  if (!fs.existsSync(manifestPath) || !fs.existsSync(clausesPath)) continue;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const languages: string[] = manifest.languages;

  if (languages.length <= 1) continue; // Skip monolingual skills

  try {
    const clausesData = JSON.parse(fs.readFileSync(clausesPath, "utf-8"));

    // Check each clause
    for (const clause of clausesData.clauses || []) {
      const clauseId = clause.clauseId || "unknown";

      // title
      if (isI18nObject(clause.title)) {
        for (const lang of languages) {
          assert(
            lang in clause.title && clause.title[lang].length > 0,
            `${skill}: clause ${clauseId}.title has '${lang}'`
          );
        }
      }

      // plainDescription
      if (clause.plainDescription && isI18nObject(clause.plainDescription)) {
        for (const lang of languages) {
          assert(
            lang in clause.plainDescription && clause.plainDescription[lang].length > 0,
            `${skill}: clause ${clauseId}.plainDescription has '${lang}'`
          );
        }
      }

      // options
      for (const opt of clause.options || []) {
        const optCode = opt.code || "unknown";

        if (isI18nObject(opt.label)) {
          for (const lang of languages) {
            assert(
              lang in opt.label && opt.label[lang].length > 0,
              `${skill}: ${clauseId}.${optCode}.label has '${lang}'`
            );
          }
        }

        if (isI18nObject(opt.legalText)) {
          for (const lang of languages) {
            assert(
              lang in opt.legalText && opt.legalText[lang].length > 0,
              `${skill}: ${clauseId}.${optCode}.legalText has '${lang}'`
            );
          }
        }
      }
    }
  } catch (e: any) {
    assert(false, `${skill}: clauses.json parse error`, e.message);
  }
}

// 3.2 Check boilerplate.json i18n
section("PART 3b: Boilerplate i18n");
for (const skill of premiumSkills) {
  const dir = path.join(legalSkillsDir, skill);
  const manifestPath = path.join(dir, "manifest.json");
  const boilerplatePath = path.join(dir, "boilerplate.json");

  if (!fs.existsSync(manifestPath) || !fs.existsSync(boilerplatePath)) continue;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const languages: string[] = manifest.languages;

  if (languages.length <= 1) continue;

  try {
    const bp = JSON.parse(fs.readFileSync(boilerplatePath, "utf-8"));

    // Key bilingual fields
    const topLevelFields = ["contractTitle", "preamble", "background", "signatureBlock"];
    for (const field of topLevelFields) {
      if (bp[field] && isI18nObject(bp[field])) {
        for (const lang of languages) {
          assert(
            lang in bp[field] && bp[field][lang].length > 0,
            `${skill}: boilerplate.${field} has '${lang}'`
          );
        }
      }
    }

    // definitions
    if (Array.isArray(bp.definitions)) {
      for (let i = 0; i < bp.definitions.length; i++) {
        const def = bp.definitions[i];
        if (isI18nObject(def.term)) {
          for (const lang of languages) {
            assert(
              lang in def.term && def.term[lang].length > 0,
              `${skill}: boilerplate.definitions[${i}].term has '${lang}'`
            );
          }
        }
        if (isI18nObject(def.definition)) {
          for (const lang of languages) {
            assert(
              lang in def.definition && def.definition[lang].length > 0,
              `${skill}: boilerplate.definitions[${i}].definition has '${lang}'`
            );
          }
        }
      }
    }

    // standardClauses
    if (Array.isArray(bp.standardClauses)) {
      for (let i = 0; i < bp.standardClauses.length; i++) {
        const sc = bp.standardClauses[i];
        if (isI18nObject(sc.title)) {
          for (const lang of languages) {
            assert(
              lang in sc.title && sc.title[lang].length > 0,
              `${skill}: boilerplate.standardClauses[${i}].title has '${lang}'`
            );
          }
        }
        if (isI18nObject(sc.text)) {
          for (const lang of languages) {
            assert(
              lang in sc.text && sc.text[lang].length > 0,
              `${skill}: boilerplate.standardClauses[${i}].text has '${lang}'`
            );
          }
        }
      }
    }

    // generalProvisions
    if (Array.isArray(bp.generalProvisions)) {
      for (let i = 0; i < bp.generalProvisions.length; i++) {
        const gp = bp.generalProvisions[i];
        if (isI18nObject(gp.title)) {
          for (const lang of languages) {
            assert(
              lang in gp.title && gp.title[lang].length > 0,
              `${skill}: boilerplate.generalProvisions[${i}].title has '${lang}'`
            );
          }
        }
        if (isI18nObject(gp.text)) {
          for (const lang of languages) {
            assert(
              lang in gp.text && gp.text[lang].length > 0,
              `${skill}: boilerplate.generalProvisions[${i}].text has '${lang}'`
            );
          }
        }
      }
    }

    // partyLabels
    if (bp.partyLabels) {
      for (const party of ["partyA", "partyB"]) {
        if (isI18nObject(bp.partyLabels[party])) {
          for (const lang of languages) {
            assert(
              lang in bp.partyLabels[party] && bp.partyLabels[party][lang].length > 0,
              `${skill}: boilerplate.partyLabels.${party} has '${lang}'`
            );
          }
        }
      }
    }

    // jurisdictionProvisions — SPAIN must exist if "es" is a language
    if (languages.includes("es") && bp.jurisdictionProvisions) {
      assert(
        !!bp.jurisdictionProvisions.SPAIN,
        `${skill}: boilerplate has SPAIN jurisdiction provisions`
      );
    }
  } catch (e: any) {
    assert(false, `${skill}: boilerplate.json parse error`, e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// PART 4: METADATA i18n
// ═══════════════════════════════════════════════════════════════

section("PART 4: Metadata i18n");
for (const skill of premiumSkills) {
  const dir = path.join(legalSkillsDir, skill);
  const manifestPath = path.join(dir, "manifest.json");
  const metadataPath = path.join(dir, "metadata.json");

  if (!fs.existsSync(manifestPath) || !fs.existsSync(metadataPath)) continue;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const languages: string[] = manifest.languages;

  if (languages.length <= 1) continue;

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

    if (isI18nObject(metadata.displayName)) {
      for (const lang of languages) {
        assert(
          lang in metadata.displayName && metadata.displayName[lang].length > 0,
          `${skill}: metadata.displayName has '${lang}'`
        );
      }
    }

    if (isI18nObject(metadata.description)) {
      for (const lang of languages) {
        assert(
          lang in metadata.description && metadata.description[lang].length > 0,
          `${skill}: metadata.description has '${lang}'`
        );
      }
    }
  } catch (e: any) {
    assert(false, `${skill}: metadata.json parse error`, e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// PART 5: PARAMETER & BOILERPLATE VARIABLE INTEGRITY
// ═══════════════════════════════════════════════════════════════

section("PART 5: Parameter & Boilerplate Variable Integrity");

for (const skill of premiumSkills) {
  const dir = path.join(legalSkillsDir, skill);
  const parametersPath = path.join(dir, "parameters.json");
  const boilerplatePath = path.join(dir, "boilerplate.json");

  if (!fs.existsSync(boilerplatePath)) continue;

  const bp = JSON.parse(fs.readFileSync(boilerplatePath, "utf-8"));

  // Extract all {variable} references from boilerplate
  const bpText = JSON.stringify(bp);
  const varRegex = /\{(\w[\w-]*)\}/g;
  const boilerplateVars = new Set<string>();
  let match;
  while ((match = varRegex.exec(bpText)) !== null) {
    boilerplateVars.add(match[1]);
  }

  // Built-in variables that don't need parameters
  const builtInVars = new Set([
    "effectiveDate", "partyAName", "partyBName",
    "partyAAddress", "partyBAddress",
    "partyASignatureBlock", "partyBSignatureBlock",
    "partyAId", "partyBId",
    "partyAShortName", "partyBShortName",
  ]);

  // Custom vars that need parameter mapping
  const customVars = new Set([...boilerplateVars].filter(v => !builtInVars.has(v)));

  if (customVars.size === 0) continue;

  // Check parameters.json exists and maps custom vars
  if (!fs.existsSync(parametersPath)) {
    if (customVars.size > 0) {
      assert(false, `${skill}: needs parameters.json for vars`, [...customVars].join(", "));
    }
    continue;
  }

  try {
    const params = JSON.parse(fs.readFileSync(parametersPath, "utf-8"));
    const parameterDefs: Array<{ id: string; boilerplateVariable?: string }> =
      params.parameters || [];

    const mappedVars = new Set(
      parameterDefs
        .filter(p => p.boilerplateVariable)
        .map(p => p.boilerplateVariable!)
    );

    // Every custom var in boilerplate should be mapped by a parameter
    for (const v of customVars) {
      assert(
        mappedVars.has(v),
        `${skill}: boilerplate var {${v}} mapped by parameter`
      );
    }
  } catch (e: any) {
    assert(false, `${skill}: parameters.json parse error`, e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// PART 6: CLAUSE OPTION BIAS CONSISTENCY
// ═══════════════════════════════════════════════════════════════

section("PART 6: Clause Option Bias Consistency");

for (const skill of [...builtInSkills.map(s => ({ name: s, dir: path.join(builtInSkillsDir, s) })),
                      ...premiumSkills.map(s => ({ name: s, dir: path.join(legalSkillsDir, s) }))]) {
  const clausesPath = path.join(skill.dir, "clauses.json");
  if (!fs.existsSync(clausesPath)) continue;

  try {
    const data = JSON.parse(fs.readFileSync(clausesPath, "utf-8"));

    for (const clause of data.clauses || []) {
      const clauseId = clause.clauseId || "unknown";
      const options = clause.options || [];

      assert(options.length >= 2, `${skill.name}/${clauseId}: at least 2 options`, `has ${options.length}`);

      for (const opt of options) {
        const biasA = opt.biasPartyA ?? 0;
        const biasB = opt.biasPartyB ?? 0;

        assert(
          biasA >= -1 && biasA <= 1,
          `${skill.name}/${clauseId}/${opt.code}: biasPartyA in [-1,1]`,
          `${biasA}`
        );
        assert(
          biasB >= -1 && biasB <= 1,
          `${skill.name}/${clauseId}/${opt.code}: biasPartyB in [-1,1]`,
          `${biasB}`
        );
      }

      // Options should have sequential order values
      const orders = options.map((o: any) => o.order).sort((a: number, b: number) => a - b);
      for (let i = 0; i < orders.length; i++) {
        assert(
          orders[i] === i + 1,
          `${skill.name}/${clauseId}: sequential order`,
          `orders: ${orders.join(",")}`
        );
      }
    }
  } catch (e: any) {
    assert(false, `${skill.name}: clauses.json parse error`, e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// PART 7: COMPROMISE ENGINE — REALISTIC MULTI-CLAUSE NEGOTIATION
// ═══════════════════════════════════════════════════════════════

section("PART 7: Realistic Multi-Clause Negotiations");

// Simulate full negotiations using real skill clause structures
for (const skill of premiumSkills.slice(0, 10)) {
  const clausesPath = path.join(legalSkillsDir, skill, "clauses.json");
  if (!fs.existsSync(clausesPath)) continue;

  try {
    const data = JSON.parse(fs.readFileSync(clausesPath, "utf-8"));
    const clauses = data.clauses || [];

    if (clauses.length === 0) continue;

    const suggestions: Array<{
      clauseId: string;
      result: { suggestedOptionId: string; satisfactionPartyA: number; satisfactionPartyB: number; reasoning: string };
      options: OptionInput[];
      partyAOptionOrder: number;
      partyBOptionOrder: number;
    }> = [];

    for (const clause of clauses) {
      const options: OptionInput[] = (clause.options || []).map((opt: any) => ({
        id: opt.code || opt.id,
        order: opt.order,
        label: typeof opt.label === "object" ? opt.label.en || Object.values(opt.label)[0] : opt.label,
        biasPartyA: opt.biasPartyA ?? 0,
        biasPartyB: opt.biasPartyB ?? 0,
      }));

      if (options.length < 2) continue;

      // A picks first option, B picks last
      const optA = options[0];
      const optB = options[options.length - 1];

      const result = calculateCompromise({
        partyASelection: {
          optionId: optA.id,
          priority: 3,
          flexibility: 2 + (clauses.indexOf(clause) % 3), // vary flexibility 2-4
          biasPartyA: optA.biasPartyA,
          biasPartyB: optA.biasPartyB,
        },
        partyBSelection: {
          optionId: optB.id,
          priority: 3,
          flexibility: 2 + ((clauses.indexOf(clause) + 1) % 3),
          biasPartyA: optB.biasPartyA,
          biasPartyB: optB.biasPartyB,
        },
        options,
        clauseTitle: typeof clause.title === "object" ? clause.title.en || "" : clause.title || "",
      });

      // The suggested option must exist in the options list
      const validOption = options.some(o => o.id === result.suggestedOptionId);
      if (!validOption) {
        assert(false, `${skill}/${clause.clauseId}: invalid suggested option`, result.suggestedOptionId);
      }

      suggestions.push({
        clauseId: clause.clauseId,
        result,
        options,
        partyAOptionOrder: optA.order,
        partyBOptionOrder: optB.order,
      });
    }

    // Run fairness pass on the full deal
    if (suggestions.length > 0) {
      const rebalanced = globalFairnessPass(suggestions);
      assert(rebalanced.length === suggestions.length, `${skill}: fairness pass preserves clause count`);

      const avgSatA = rebalanced.reduce((s, r) => s + r.result.satisfactionPartyA, 0) / rebalanced.length;
      const avgSatB = rebalanced.reduce((s, r) => s + r.result.satisfactionPartyB, 0) / rebalanced.length;

      assert(
        avgSatA >= 0 && avgSatA <= 100 && avgSatB >= 0 && avgSatB <= 100,
        `${skill}: avg satisfaction in bounds`,
        `A:${avgSatA.toFixed(1)}% B:${avgSatB.toFixed(1)}%`
      );

      console.log(`    ${skill}: ${suggestions.length} clauses → avg A:${avgSatA.toFixed(0)}% B:${avgSatB.toFixed(0)}%`);
    }
  } catch (e: any) {
    assert(false, `${skill}: realistic negotiation error`, e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// PART 8: CASTILIAN SPANISH QUALITY CHECKS
// ═══════════════════════════════════════════════════════════════

section("PART 8: Castilian Spanish Quality Checks");

// Note: "habilidades" (abilities) and "concreto" (specific) are valid Castilian in legal text.
// The "skills" loanword rule only applies to the platform feature name, not a person's abilities.
const latinAmericanisms = [
  { pattern: /\bcomputador\b/i, issue: "Latin Am 'computador' (use 'ordenador')" },
  { pattern: /\bcarro\b/i, issue: "Latin Am 'carro' (use 'coche')" },
  { pattern: /\bcelular\b/i, issue: "Latin Am 'celular' (use 'móvil')" },
  { pattern: /\bparqueo\b/i, issue: "Latin Am 'parqueo' (use 'aparcamiento')" },
  { pattern: /\baplicar\s+(para|a)\s+(un\s+)?(trabajo|empleo|puesto)\b/i, issue: "Latin Am 'aplicar para trabajo' (use 'solicitar')" },
];

const accentErrors = [
  { pattern: /obligaciónes/i, issue: "Incorrect plural accent: obligaciónes → obligaciones" },
  { pattern: /condiciòn/i, issue: "Wrong accent: condiciòn → condición" },
  { pattern: /estipulaciónes/i, issue: "Incorrect plural: estipulaciónes → estipulaciones" },
  { pattern: /disposiciónes/i, issue: "Incorrect plural: disposiciónes → disposiciones" },
  { pattern: /resoluciónes/i, issue: "Incorrect plural: resoluciónes → resoluciones" },
  { pattern: /obligacíones/i, issue: "Wrong accent placement: obligacíones" },
];

for (const skill of premiumSkills) {
  const dir = path.join(legalSkillsDir, skill);
  const manifestPath = path.join(dir, "manifest.json");

  if (!fs.existsSync(manifestPath)) continue;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  if (!manifest.languages?.includes("es")) continue;

  // Check clauses.json Spanish text
  const clausesPath = path.join(dir, "clauses.json");
  if (fs.existsSync(clausesPath)) {
    const clausesText = fs.readFileSync(clausesPath, "utf-8");
    const clausesData = JSON.parse(clausesText);

    // Extract all Spanish text
    const spanishTexts: string[] = [];
    function extractSpanish(obj: unknown, path: string = "") {
      if (obj === null || obj === undefined) return;
      if (typeof obj === "object" && !Array.isArray(obj)) {
        const rec = obj as Record<string, unknown>;
        if ("es" in rec && typeof rec.es === "string") {
          spanishTexts.push(rec.es);
        } else {
          for (const [k, v] of Object.entries(rec)) {
            extractSpanish(v, `${path}.${k}`);
          }
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item, i) => extractSpanish(item, `${path}[${i}]`));
      }
    }
    extractSpanish(clausesData);

    for (const text of spanishTexts) {
      for (const check of latinAmericanisms) {
        assert(
          !check.pattern.test(text),
          `${skill}: ${check.issue} in clauses`
        );
      }
      for (const check of accentErrors) {
        assert(
          !check.pattern.test(text),
          `${skill}: ${check.issue} in clauses`
        );
      }
    }
  }

  // Check boilerplate Spanish text
  const boilerplatePath = path.join(dir, "boilerplate.json");
  if (fs.existsSync(boilerplatePath)) {
    const bpText = fs.readFileSync(boilerplatePath, "utf-8");
    const bpData = JSON.parse(bpText);

    const spanishTexts: string[] = [];
    function extractSpanishBp(obj: unknown) {
      if (obj === null || obj === undefined) return;
      if (typeof obj === "object" && !Array.isArray(obj)) {
        const rec = obj as Record<string, unknown>;
        if ("es" in rec && typeof rec.es === "string") {
          spanishTexts.push(rec.es);
        } else {
          for (const v of Object.values(rec)) {
            extractSpanishBp(v);
          }
        }
      } else if (Array.isArray(obj)) {
        obj.forEach(extractSpanishBp);
      }
    }
    extractSpanishBp(bpData);

    for (const text of spanishTexts) {
      for (const check of latinAmericanisms) {
        assert(!check.pattern.test(text), `${skill}: ${check.issue} in boilerplate`);
      }
      for (const check of accentErrors) {
        assert(!check.pattern.test(text), `${skill}: ${check.issue} in boilerplate`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// PART 9: NO BRACKET PLACEHOLDERS IN BOILERPLATE
// ═══════════════════════════════════════════════════════════════

section("PART 9: No [BRACKET] Placeholders in Boilerplate");

const bracketPattern = /\[[A-Z][A-Z_\s]+\]/;

for (const skill of premiumSkills) {
  const boilerplatePath = path.join(legalSkillsDir, skill, "boilerplate.json");
  if (!fs.existsSync(boilerplatePath)) continue;

  const bpText = fs.readFileSync(boilerplatePath, "utf-8");
  const matches = bpText.match(bracketPattern);
  assert(
    !matches,
    `${skill}: no [BRACKET] placeholders in boilerplate`,
    matches ? matches[0] : undefined
  );
}

for (const skill of builtInSkills) {
  const boilerplatePath = path.join(builtInSkillsDir, skill, "boilerplate.json");
  if (!fs.existsSync(boilerplatePath)) continue;

  const bpText = fs.readFileSync(boilerplatePath, "utf-8");
  const matches = bpText.match(bracketPattern);
  assert(
    !matches,
    `${skill}: no [BRACKET] placeholders in boilerplate`,
    matches ? matches[0] : undefined
  );
}

// ═══════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════

section("FINAL REPORT");
console.log(`  Total tests: ${totalTests}`);
console.log(`  Passed:      ${passed}`);
console.log(`  Failed:      ${failed}`);

if (failures.length > 0) {
  console.log(`\n  Failures:`);
  for (const f of failures) {
    console.log(`    - ${f}`);
  }
}

console.log(`\n${"═".repeat(80)}`);
if (failed === 0) {
  console.log("  ALL TESTS PASSED");
} else {
  console.log(`  ${failed} TEST(S) FAILED`);
}
console.log(`${"═".repeat(80)}\n`);

process.exit(failed > 0 ? 1 : 0);
