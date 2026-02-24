/**
 * Generate Sample Contract PDFs
 *
 * Produces completed PDFs for every skill with three variants each:
 * - Party A friendly (highest biasPartyA options)
 * - Party B friendly (highest biasPartyB options)
 * - Balanced (middle option or lowest absolute bias)
 *
 * Usage: npx tsx scripts/generate-sample-pdfs.tsx
 */

import fs from "fs";
import path from "path";
import { renderToBuffer } from "@react-pdf/renderer";
import { ContractPDF } from "../src/server/services/document/ContractPDF";
import type { ContractData, ClauseData, BoilerplateData } from "../src/server/services/document/generator";
import { interpolateParameters, buildBoilerplateVariables, type ParameterSchema } from "../src/lib/parameters";

const LEGALSKILLS_DIR = "/Users/sme/NEL/legalskills";
const BUILTIN_SKILLS_DIR = path.resolve(__dirname, "../skills");
const OUTPUT_DIR = path.resolve(__dirname, "../sample-pdfs");

const GOVERNING_LAW_DISPLAY: Record<string, Record<string, string>> = {
  CALIFORNIA: {
    en: "State of California, United States of America",
    es: "Estado de California, EE.UU.",
  },
  ENGLAND_WALES: {
    en: "England and Wales, United Kingdom",
    es: "Inglaterra y Gales, Reino Unido",
  },
  SPAIN: {
    en: "Kingdom of Spain",
    es: "Reino de España",
  },
};

interface SkillClauseOption {
  id: string;
  code: string;
  label: { en: string; es?: string } | string;
  order: number;
  legalText: { en: string; es?: string } | string;
  biasPartyA: number;
  biasPartyB: number;
}

interface SkillClause {
  id: string;
  title: { en: string; es?: string } | string;
  category: string;
  order: number;
  options: SkillClauseOption[];
}

interface SkillData {
  contractType: string;
  displayName: { en: string; es?: string } | string;
  clauses: SkillClause[];
}

// Demo parameter values for parameterized templates
const DEMO_PARAMETERS: Record<string, Record<string, string>> = {
  SEED_INVESTMENT: {
    "pre-money-valuation": "$2,000,000",
    "investment-amount": "$500,000",
    "share-count": "500,000",
    "share-price": "$1.00",
    "board-size": "3",
    "dividend-rate": "8",
    "qualified-financing-threshold": "$1,000,000",
    "lock-up-months": "12",
    "legal-fee-cap": "$25,000",
    "business-description": "developing AI-powered legal technology solutions",
    "court-county": "San Francisco",
    "court-city": "Madrid",
    "arbitration-institution": "ICC (International Chamber of Commerce)",
    "arbitration-language": "English",
  },
  CONVERTIBLE_NOTE: {
    "principal-amount": "500,000",
    "valuation-cap-amount": "5,000,000",
    "prepayment-premium": "5",
  },
  SAFE: {
    "valuation-cap-amount": "5,000,000",
    "pro-rata-threshold": "1,000,000",
  },
  TERM_SHEET: {
    "round-amount": "3,000,000",
    "closing-date": "December 31, 2026",
    "series-designation": "A",
    "round-minimum": "1,000,000",
    "round-maximum": "5,000,000",
    "milestone-1": "Product launch",
    "milestone-2": "1,000 active users",
    "round-tranche-count": "2",
    "pre-money-valuation": "10,000,000",
    "original-issue-price": "1.00",
    "option-pool-pct": "10",
    "liquidation-multiple": "1",
    "debt-threshold": "100,000",
    "dividend-rate": "8",
    "legal-fee-cap": "25,000",
  },
  CONSULTING: {
    "service-description": "software development and technical advisory services",
    "monthly-hours": "40",
    "deposit-pct": "25",
    "hourly-rate": "250",
    "max-hours": "160",
    "term-months": "12",
    "start-date": "January 1, 2026",
    "geographic-area": "State of California",
    "kill-fee-pct": "25",
    "liability-multiple": "2",
  },
  SHAREHOLDERS: {
    "board-size": "5",
    "board-appoint-pct": "20",
    "appointing-body": "Nominating Committee",
    "transaction-threshold": "50,000",
    "lockup-months": "24",
    "min-distribution-pct": "30",
    "mediation-body": "CEDR",
    "exit-years": "5",
    "non-compete-area": "United States",
    "court-city": "London",
    "court-county": "San Francisco",
    "arbitration-body": "ICC",
  },
  EMPLOYMENT: {
    "start-date": "March 1, 2026",
    "end-date": "February 28, 2027",
    "base-salary": "120,000",
    "base-amount": "120,000",
    "bonus-pct": "20",
    "equity-shares": "10,000",
    "office-days": "3",
    "office-address": "100 Market St, San Francisco, CA 94105",
    "time-zone": "Pacific Time (PT)",
    "non-compete-area": "State of California",
    "dispute-city": "San Francisco",
    "arbitration-body": "JAMS",
  },
  IP_ASSIGNMENT: {
    "ip-start-date": "January 1, 2024",
    "ip-end-date": "December 31, 2025",
    "subject-matter": "mobile application for fleet management",
    "assignment-fee": "50,000",
    "royalty-years": "5",
    "royalty-pct": "5",
  },
};

type Variant = "partyA" | "partyB" | "balanced";

function getLabel(field: { en: string; es?: string } | string, lang: string = "en"): string {
  if (typeof field === "string") return field;
  return (lang !== "en" && field[lang as keyof typeof field]) || field.en;
}

function pickOption(options: SkillClauseOption[], variant: Variant): SkillClauseOption {
  const sorted = [...options].sort((a, b) => a.order - b.order);
  if (variant === "partyA") {
    // Highest biasPartyA
    return sorted.reduce((best, o) => o.biasPartyA > best.biasPartyA ? o : best, sorted[0]);
  }
  if (variant === "partyB") {
    // Highest biasPartyB
    return sorted.reduce((best, o) => o.biasPartyB > best.biasPartyB ? o : best, sorted[0]);
  }
  // Balanced: lowest absolute combined bias, or middle option
  return sorted.reduce((best, o) => {
    const absBias = Math.abs(o.biasPartyA) + Math.abs(o.biasPartyB);
    const bestBias = Math.abs(best.biasPartyA) + Math.abs(best.biasPartyB);
    return absBias < bestBias ? o : best;
  }, sorted[Math.floor(sorted.length / 2)]);
}

function getLegalText(option: SkillClauseOption, lang: string = "en"): string {
  if (typeof option.legalText === "string") return option.legalText;
  return (lang !== "en" && option.legalText[lang as keyof typeof option.legalText]) || option.legalText.en;
}

function buildContractData(
  skill: SkillData,
  variant: Variant,
  boilerplate: BoilerplateData | null,
  governingLaw: string,
  language: string = "en",
  paramSchema: ParameterSchema | null = null,
  paramValues: Record<string, string> = {},
): ContractData {
  const variantLabels: Record<Variant, string> = {
    partyA: "Party A Friendly",
    partyB: "Party B Friendly",
    balanced: "Balanced",
  };

  const displayName = getLabel(skill.displayName, language);

  const clauses: ClauseData[] = skill.clauses.map((clause) => {
    const chosen = pickOption(clause.options, variant);
    let legalText = getLegalText(chosen, language);
    // Apply parameter interpolation
    if (paramSchema?.parameters?.length) {
      legalText = interpolateParameters(legalText, paramValues, paramSchema, clause.id, language);
    }
    return {
      title: getLabel(clause.title, language),
      category: clause.category,
      agreedOption: getLabel(chosen.label, language),
      legalText,
    };
  });

  const partyA = {
    name: "Alice Johnson",
    email: "alice@acmecorp.com",
    company: "Acme Corp",
    legalName: "Acme Corp, Inc.",
    address: "100 Market Street, Suite 300, San Francisco, CA 94105",
    taxId: "94-1234567",
    signatoryName: "Alice Johnson",
    signatoryTitle: "Chief Executive Officer",
  };
  const partyB = {
    name: "Bob Smith",
    email: "bob@widgetsinc.com",
    company: "Widgets Inc",
    legalName: "Widgets Inc.",
    address: "200 Broadway, Floor 10, New York, NY 10007",
    taxId: "13-7654321",
    signatoryName: "Bob Smith",
    signatoryTitle: "Managing Director",
  };

  // Interpolate boilerplate variables
  if (boilerplate) {
    const dateLocale = language === "es" ? "es-ES" : "en-US";
    const paramVars = buildBoilerplateVariables(paramValues, paramSchema);
    const variables: Record<string, string> = {
      effectiveDate: new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" }),
      partyAName: partyA.legalName,
      partyBName: partyB.legalName,
      partyAAddress: partyA.address,
      partyBAddress: partyB.address,
      partyAId: partyA.taxId,
      partyBId: partyB.taxId,
      partyAShortName: "Party A",
      partyBShortName: "Party B",
      partyASignatureBlock: `For and on behalf of ${partyA.legalName}:\n\nSignature: _______________________________\n\nName: ${partyA.signatoryName}\n\nTitle: ${partyA.signatoryTitle}\n\nDate: ___________________________________`,
      partyBSignatureBlock: `For and on behalf of ${partyB.legalName}:\n\nSignature: _______________________________\n\nName: ${partyB.signatoryName}\n\nTitle: ${partyB.signatoryTitle}\n\nDate: ___________________________________`,
      ...paramVars,
    };

    const interpolate = (text: string) =>
      text.replace(/\{(\w+)\}/g, (match, key) => variables[key] || match);

    boilerplate = {
      ...boilerplate,
      preamble: interpolate(boilerplate.preamble),
      background: boilerplate.background ? interpolate(boilerplate.background) : undefined,
      definitions: boilerplate.definitions.map((d) => ({
        term: d.term,
        definition: interpolate(d.definition),
      })),
      standardClauses: boilerplate.standardClauses.map((c) => ({
        title: c.title,
        text: interpolate(c.text),
      })),
      generalProvisions: boilerplate.generalProvisions.map((p) => ({
        title: p.title,
        text: interpolate(p.text),
      })),
      jurisdictionProvision: boilerplate.jurisdictionProvision
        ? {
            title: boilerplate.jurisdictionProvision.title,
            text: interpolate(boilerplate.jurisdictionProvision.text),
          }
        : null,
      signatureBlock: interpolate(boilerplate.signatureBlock),
    };
  }

  return {
    dealName: `${displayName} — ${variantLabels[variant]}`,
    contractType: displayName,
    governingLaw: GOVERNING_LAW_DISPLAY[governingLaw]?.[language] || GOVERNING_LAW_DISPLAY[governingLaw]?.en || governingLaw,
    governingLawKey: governingLaw,
    createdAt: new Date(),
    partyA,
    partyB,
    clauses,
    boilerplate,
    language,
  };
}

function loadBoilerplate(skillDir: string, governingLaw: string, language: string = "en"): BoilerplateData | null {
  const boilerplatePath = path.join(skillDir, "boilerplate.json");
  if (!fs.existsSync(boilerplatePath)) return null;

  const raw = JSON.parse(fs.readFileSync(boilerplatePath, "utf-8"));
  // resolve handles both plain strings and i18n objects {en, es}
  const resolve = (val: unknown): string => {
    if (typeof val === "string") return val;
    if (val && typeof val === "object" && "en" in val) return getLabel(val as { en: string; es?: string }, language);
    return "";
  };

  const jp = raw.jurisdictionProvisions?.[governingLaw];
  const jurisdictionProvision = jp
    ? { title: resolve(jp.title), text: resolve(jp.text) }
    : null;

  return {
    contractTitle: resolve(raw.contractTitle),
    preamble: resolve(raw.preamble),
    background: raw.background ? resolve(raw.background) : undefined,
    definitions: (raw.definitions || []).map((d: Record<string, unknown>) => ({
      term: resolve(d.term),
      definition: resolve(d.definition),
    })),
    standardClauses: (raw.standardClauses || []).map((c: Record<string, unknown>) => ({
      title: resolve(c.title),
      text: resolve(c.text),
    })),
    generalProvisions: (raw.generalProvisions || []).map((p: Record<string, unknown>) => ({
      title: resolve(p.title),
      text: resolve(p.text),
    })),
    jurisdictionProvision,
    signatureBlock: resolve(raw.signatureBlock),
    partyLabels: raw.partyLabels
      ? { partyA: resolve(raw.partyLabels.partyA), partyB: resolve(raw.partyLabels.partyB) }
      : undefined,
  };
}

interface SkillSource {
  name: string;
  dir: string;
  governingLaw: string;
  language: string;
}

async function main() {
  // Ensure output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Collect all skills
  const skills: SkillSource[] = [];

  // Built-in skills (scan all subdirectories)
  if (fs.existsSync(BUILTIN_SKILLS_DIR)) {
    for (const entry of fs.readdirSync(BUILTIN_SKILLS_DIR)) {
      const skillDir = path.join(BUILTIN_SKILLS_DIR, entry);
      if (!fs.statSync(skillDir).isDirectory()) continue;
      if (!fs.existsSync(path.join(skillDir, "clauses.json"))) continue;
      // Pick governing law and language from metadata or default
      let governingLaw = "ENGLAND_WALES";
      let language = "en";
      const metaPath = path.join(skillDir, "metadata.json");
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        if (meta.jurisdictions?.includes("CALIFORNIA")) governingLaw = "CALIFORNIA";
        if (meta.languages?.[0]) language = meta.languages[0];
      }
      skills.push({ name: entry, dir: skillDir, governingLaw, language });
    }
  }

  // Licensed skills
  for (const entry of fs.readdirSync(LEGALSKILLS_DIR)) {
    const skillDir = path.join(LEGALSKILLS_DIR, entry);
    const clausesPath = path.join(skillDir, "clauses.json");
    if (fs.existsSync(clausesPath) && entry !== "_template") {
      // Detect governing law and language from manifest
      let governingLaw = entry === "pacto-socios" ? "SPAIN" : "CALIFORNIA";
      let language = "en";
      const manifestPath = path.join(skillDir, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        if (manifest.languages?.[0]) language = manifest.languages[0];
      }
      skills.push({ name: entry, dir: skillDir, governingLaw, language });
    }
  }

  console.log(`Found ${skills.length} skills: ${skills.map((s) => s.name).join(", ")}`);

  const variants: Variant[] = ["partyA", "partyB", "balanced"];
  let count = 0;

  for (const skill of skills) {
    const clausesData: SkillData = JSON.parse(
      fs.readFileSync(path.join(skill.dir, "clauses.json"), "utf-8")
    );
    const boilerplate = loadBoilerplate(skill.dir, skill.governingLaw, skill.language);

    // Load parameters.json if present
    let paramSchema: ParameterSchema | null = null;
    const paramsPath = path.join(skill.dir, "parameters.json");
    if (fs.existsSync(paramsPath)) {
      paramSchema = JSON.parse(fs.readFileSync(paramsPath, "utf-8"));
    }
    const paramValues = DEMO_PARAMETERS[clausesData.contractType] || {};

    for (const variant of variants) {
      const contractData = buildContractData(clausesData, variant, boilerplate, skill.governingLaw, skill.language, paramSchema, paramValues);
      const filename = `${skill.name}_${variant}.pdf`;
      const outPath = path.join(OUTPUT_DIR, filename);

      console.log(`  Generating ${filename}...`);
      const buffer = await renderToBuffer(ContractPDF({ data: contractData }));
      fs.writeFileSync(outPath, buffer);
      count++;
    }
  }

  console.log(`\nDone! Generated ${count} PDFs in ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
