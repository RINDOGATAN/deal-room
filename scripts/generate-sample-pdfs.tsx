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

const LEGALSKILLS_DIR = process.env.SKILLS_DIR || "./legalskills";
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
    "company-name": "Acme Technologies Ltd.",
    "company-jurisdiction": "England and Wales",
    "company-number": "12345678",
    "company-address": "200 High Holborn, London WC1V 7EX",
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
  ADVERTISING_IO: {
    "campaign-name": "Q2 Brand Awareness Campaign",
    "total-budget": "$100,000",
    "start-date": "April 1, 2026",
    "end-date": "June 30, 2026",
    "impressions-target": "5,000,000",
    "base-cpm": "$12.50",
  },
  AFFILIATE_PROGRAM: {
    "program-name": "Partner Referral Program",
    "base-commission": "20",
    "cookie-window": "30",
    "disclosure-text": "This content contains affiliate links.",
    "product-category": "legal technology software",
  },
  DATA_LICENSING: {
    "data-categories": "anonymized user analytics and usage metrics",
    "license-fee": "$50,000",
    "license-term": "24 months",
  },
  INFLUENCER_MARKETING: {
    "campaign-name": "Summer Product Launch",
    "total-compensation": "$25,000",
    "num-deliverables": "10",
    "campaign-start": "June 1, 2026",
    "campaign-end": "August 31, 2026",
  },
  WHITE_LABEL_RESELLER: {
    "territory": "European Union",
    "minimum-commitment": "$100,000",
    "revenue-share-pct": "30",
    "support-sla-hours": "24",
  },
  ADVISORY: {
    "advisory-scope": "strategic market entry and product positioning",
    "term-months": "12",
    "monthly-retainer": "5,000",
    "equity-pct": "0.5",
    "meeting-frequency": "monthly",
    "non-compete-months": "12",
    "geographic-area": "United States and European Union",
  },
  TECHNOLOGY_LICENSE: {
    "technology-description": "proprietary AI-powered document analysis engine",
    "license-fee": "$150,000",
    "royalty-pct": "5",
    "term-years": "5",
    "territory": "worldwide",
    "support-hours": "40",
  },
  JOINT_VENTURE: {
    "jv-purpose": "development and commercialization of AI-powered legal compliance tools",
    "initial-contribution-a": "$500,000",
    "initial-contribution-b": "$500,000",
    "profit-split-pct": "50",
    "term-years": "5",
    "board-size": "4",
    "exit-notice-months": "6",
  },
  SOFTWARE_DEVELOPMENT: {
    "project-description": "custom enterprise resource planning system with mobile companion app",
    "total-fee": "$350,000",
    "milestone-count": "5",
    "acceptance-days": "14",
    "warranty-months": "12",
    "change-order-hourly-rate": "$200",
  },
  EQUITY_INCENTIVE: {
    "plan-name": "2026 Equity Incentive Plan",
    "total-pool-shares": "1,000,000",
    "pool-pct": "10",
    "cliff-months": "12",
    "vesting-months": "48",
    "exercise-window-days": "90",
    "strike-price": "$1.00",
  },
  ACTA_JUNTA_GENERAL: {
    "company-name": "Acme Technologies, S.L.",
    "cif": "B12345678",
    "registered-address": "Calle Gran Vía 1, 28013 Madrid",
    "meeting-date": "15 de marzo de 2026",
    "meeting-type": "Ordinaria",
    "quorum-percentage": "75%",
    "secretary-name": "María García López",
    "president-name": "Juan Martínez Ruiz",
  },
  ACTA_CONSEJO_ADMINISTRACION: {
    "company-name": "Acme Technologies, S.L.",
    "cif": "B12345678",
    "registered-address": "Calle Gran Vía 1, 28013 Madrid",
    "meeting-date": "15 de marzo de 2026",
    "president-name": "Juan Martínez Ruiz",
    "secretary-name": "María García López",
  },
  PHANTOM_SHARES_PLAN: {
    "company-name": "Acme Technologies, S.L.",
    "cif": "B12345678",
    "total-pool-percentage": "10%",
    "cliff-months": "12",
    "vesting-months": "48",
    "plan-effective-date": "1 de enero de 2026",
    "city": "Madrid",
  },
  PHANTOM_SHARES_GRANT: {
    "employee-name": "Ana López García",
    "phantom-count": "1.000",
    "grant-date": "15 de marzo de 2026",
    "plan-date": "1 de enero de 2026",
    "individual-vesting-months": "48",
    "city": "Madrid",
  },
  PRIVACY_NOTICE: {
    "jurisdictions": "CALIFORNIA,ENGLAND_WALES,SPAIN",
    "company-name": "Acme Technologies Inc.",
    "company-website": "https://acme.example.com",
    "dpo-email": "privacy@acme.example.com",
    "effective-date": "March 1, 2026",
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
      category: typeof clause.category === "string" ? clause.category : getLabel(clause.category, language),
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
      contractTitle: interpolate(boilerplate.contractTitle),
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
  jurisdictions: string[];
  languages: string[];
}

async function main() {
  // Ensure output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Collect all skills with their full jurisdiction/language matrix
  const skills: SkillSource[] = [];

  // Built-in skills
  if (fs.existsSync(BUILTIN_SKILLS_DIR)) {
    for (const entry of fs.readdirSync(BUILTIN_SKILLS_DIR)) {
      const skillDir = path.join(BUILTIN_SKILLS_DIR, entry);
      if (!fs.statSync(skillDir).isDirectory()) continue;
      if (!fs.existsSync(path.join(skillDir, "clauses.json"))) continue;
      // Built-in skills support all jurisdictions and both languages
      skills.push({
        name: entry,
        dir: skillDir,
        jurisdictions: ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"],
        languages: ["en", "es"],
      });
    }
  }

  // Licensed skills — read jurisdictions/languages from manifest
  const legalDir = path.resolve(LEGALSKILLS_DIR);
  if (fs.existsSync(legalDir)) {
    for (const entry of fs.readdirSync(legalDir)) {
      const skillDir = path.join(legalDir, entry);
      if (!fs.statSync(skillDir).isDirectory()) continue;
      if (entry.startsWith(".") || entry.startsWith("_") || entry === "node_modules" || entry === "dist") continue;
      if (!fs.existsSync(path.join(skillDir, "clauses.json"))) continue;

      let jurisdictions = ["CALIFORNIA"];
      let languages = ["en"];
      const manifestPath = path.join(skillDir, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        if (Array.isArray(manifest.jurisdictions)) jurisdictions = manifest.jurisdictions;
        if (Array.isArray(manifest.languages)) languages = manifest.languages;
      }
      skills.push({ name: entry, dir: skillDir, jurisdictions, languages });
    }
  }

  console.log(`Found ${skills.length} skills\n`);

  let count = 0;
  const errors: string[] = [];

  for (const skill of skills) {
    const clausesData: SkillData = JSON.parse(
      fs.readFileSync(path.join(skill.dir, "clauses.json"), "utf-8")
    );

    let paramSchema: ParameterSchema | null = null;
    const paramsPath = path.join(skill.dir, "parameters.json");
    if (fs.existsSync(paramsPath)) {
      paramSchema = JSON.parse(fs.readFileSync(paramsPath, "utf-8"));
    }
    const paramValues = DEMO_PARAMETERS[clausesData.contractType] || {};

    // Generate balanced PDF for every jurisdiction × language combo
    for (const jurisdiction of skill.jurisdictions) {
      for (const language of skill.languages) {
        const boilerplate = loadBoilerplate(skill.dir, jurisdiction, language);
        const contractData = buildContractData(
          clausesData, "balanced", boilerplate, jurisdiction, language, paramSchema, paramValues
        );

        const jurisShort = jurisdiction === "ENGLAND_WALES" ? "EW" : jurisdiction === "CALIFORNIA" ? "CA" : "ES";
        const filename = `${skill.name}_${jurisShort}_${language}.pdf`;
        const outPath = path.join(OUTPUT_DIR, filename);

        // Deep scan for unresolved i18n objects before rendering
        const findUnresolved = (obj: unknown, p: string): string[] => {
          const hits: string[] = [];
          if (obj === null || obj === undefined || typeof obj !== "object") return hits;
          if (!Array.isArray(obj) && "en" in (obj as Record<string, unknown>) && "es" in (obj as Record<string, unknown>)) {
            hits.push(p);
          } else if (Array.isArray(obj)) {
            obj.forEach((item, i) => hits.push(...findUnresolved(item, `${p}[${i}]`)));
          } else {
            for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
              if (typeof v === "object" && v !== null) hits.push(...findUnresolved(v, `${p}.${k}`));
            }
          }
          return hits;
        };
        const leaks = findUnresolved(contractData, "data");
        if (leaks.length > 0) {
          console.log(`    ⚠ i18n leaks in ${filename}: ${leaks.join(", ")}`);
        }

        try {
          const buffer = await renderToBuffer(ContractPDF({ data: contractData }));
          fs.writeFileSync(outPath, buffer);
          count++;

          // Check for unresolved variables
          const allText = JSON.stringify(contractData);
          const unresolved = allText.match(/\{(\w[\w-]*)\}/g);
          const unresolvedFiltered = unresolved?.filter(
            (v) => !v.match(/^\{(partyA|partyB)(SignatureBlock|Name|Address|Id|ShortName)\}$/)
          );
          const warn = unresolvedFiltered?.length ? ` ⚠ unresolved: ${[...new Set(unresolvedFiltered)].join(", ")}` : "";

          console.log(`  ✓ ${filename} (${contractData.clauses.length} clauses, ${(buffer.length / 1024).toFixed(0)}KB)${warn}`);
        } catch (err: any) {
          const msg = `${filename}: ${err.message}`;
          errors.push(msg);
          console.log(`  ✗ ${msg}`);
        }
      }
    }
  }

  console.log(`\n${"═".repeat(70)}`);
  console.log(`Generated ${count} PDFs in ${OUTPUT_DIR}`);
  if (errors.length > 0) {
    console.log(`\n${errors.length} errors:`);
    for (const e of errors) console.log(`  - ${e}`);
  }
  console.log(`${"═".repeat(70)}\n`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
