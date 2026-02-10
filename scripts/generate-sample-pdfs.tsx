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
): ContractData {
  const variantLabels: Record<Variant, string> = {
    partyA: "Party A Friendly",
    partyB: "Party B Friendly",
    balanced: "Balanced",
  };

  const displayName = getLabel(skill.displayName, language);

  const clauses: ClauseData[] = skill.clauses.map((clause) => {
    const chosen = pickOption(clause.options, variant);
    return {
      title: getLabel(clause.title, language),
      category: clause.category,
      agreedOption: getLabel(chosen.label, language),
      legalText: getLegalText(chosen, language),
    };
  });

  const partyA = { name: "Alice Johnson", email: "alice@acmecorp.com", company: "Acme Corp" };
  const partyB = { name: "Bob Smith", email: "bob@widgetsinc.com", company: "Widgets Inc" };

  // Interpolate boilerplate variables
  if (boilerplate) {
    const dateLocale = language === "es" ? "es-ES" : "en-US";
    const variables: Record<string, string> = {
      effectiveDate: new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" }),
      partyAName: partyA.company,
      partyBName: partyB.company,
      partyAAddress: "[Address]",
      partyBAddress: "[Address]",
      partyAShortName: "Party A",
      partyBShortName: "Party B",
      partyASignatureBlock: `For and on behalf of ${partyA.company}:\n\nSignature: _______________________________\n\nName: ${partyA.name}\n\nTitle: [Title]\n\nDate: ___________________________________`,
      partyBSignatureBlock: `For and on behalf of ${partyB.company}:\n\nSignature: _______________________________\n\nName: ${partyB.name}\n\nTitle: [Title]\n\nDate: ___________________________________`,
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

function loadBoilerplate(skillDir: string, governingLaw: string): BoilerplateData | null {
  const boilerplatePath = path.join(skillDir, "boilerplate.json");
  if (!fs.existsSync(boilerplatePath)) return null;

  const raw = JSON.parse(fs.readFileSync(boilerplatePath, "utf-8"));
  const jurisdictionProvision = raw.jurisdictionProvisions?.[governingLaw]
    ? { title: raw.jurisdictionProvisions[governingLaw].title, text: raw.jurisdictionProvisions[governingLaw].text }
    : null;

  return {
    contractTitle: raw.contractTitle || "",
    preamble: raw.preamble || "",
    background: raw.background || undefined,
    definitions: raw.definitions || [],
    standardClauses: raw.standardClauses || [],
    generalProvisions: raw.generalProvisions || [],
    jurisdictionProvision,
    signatureBlock: raw.signatureBlock || "",
    partyLabels: raw.partyLabels || undefined,
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
    const boilerplate = loadBoilerplate(skill.dir, skill.governingLaw);

    for (const variant of variants) {
      const contractData = buildContractData(clausesData, variant, boilerplate, skill.governingLaw, skill.language);
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
