import { Prisma, PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const prisma = new PrismaClient();

const BUILTIN_SKILLS_DIR = path.join(__dirname, "..", "skills");
const SKILLS_DIR = process.env.SKILLS_DIR || "";

interface SkillMetadata {
  contractType: string;
  displayName: string | Record<string, string>;
  description?: string | Record<string, string>;
  category?: string | Record<string, string>;
  version: string;
  clauseCount: number;
  jurisdictions?: string[];
  languages?: string[];
}

interface SkillManifest {
  skillId: string;
  name: string;
  displayName: string;
  version: string;
  jurisdictions: string[];
  languages: string[];
  author?: string;
  license?: string;
  templateFamily?: string;
  nativeJurisdiction?: string;
}

interface ClauseMappingEntry {
  source: string | null;
  target: string;
  type: string;
  notes?: string;
}

interface ClauseMappingsFile {
  family: string;
  sourceTemplate: string;
  targetTemplate: string;
  mappings: ClauseMappingEntry[];
}

interface JurisdictionRule {
  available: boolean;
  warning?: string;
  note?: string;
}

interface JurisdictionConfig {
  [key: string]: JurisdictionRule | undefined;
  CALIFORNIA?: JurisdictionRule;
  ENGLAND_WALES?: JurisdictionRule;
  SPAIN?: JurisdictionRule;
}

interface ClauseOption {
  id: string;
  code: string;
  label: LocalizedString;
  order: number;
  plainDescription: LocalizedString;
  prosPartyA: LocalizedArray;
  consPartyA: LocalizedArray;
  prosPartyB: LocalizedArray;
  consPartyB: LocalizedArray;
  legalText: LocalizedString;
  biasPartyA: number;
  biasPartyB: number;
  jurisdictionConfig?: JurisdictionConfig;
}

interface Clause {
  id: string;
  title: LocalizedString;
  category: string;
  order: number;
  plainDescription: LocalizedString;
  legalContext?: LocalizedString;
  isRequired?: boolean;
  options: ClauseOption[];
}

type LocalizedString = string | Record<string, string>;
type LocalizedArray = string[] | Record<string, string[]>;

interface SkillClauses {
  contractType: string;
  displayName: LocalizedString;
  description?: LocalizedString;
  version: string;
  clauses: Clause[];
}

// Resolve i18n value to a flat string (default language: "en")
function resolveString(value: string | Record<string, string> | undefined, fallback = ""): string {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value.en || Object.values(value)[0] || fallback;
}

// Resolve i18n array to a flat string array (default language: "en")
function resolveArray(value: string[] | Record<string, string[]> | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.en || Object.values(value)[0] || [];
}

// Check if a value is a localized object (not a plain string/array)
function isLocalized(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Build localizedContent JSON for a ClauseTemplate if it has i18n content
function buildClauseLocalizedContent(clause: Clause): Record<string, unknown> | undefined {
  const content: Record<string, unknown> = {};
  let hasLocalized = false;

  if (isLocalized(clause.title)) { content.title = clause.title; hasLocalized = true; }
  if (isLocalized(clause.plainDescription)) { content.plainDescription = clause.plainDescription; hasLocalized = true; }
  if (clause.legalContext && isLocalized(clause.legalContext)) { content.legalContext = clause.legalContext; hasLocalized = true; }

  return hasLocalized ? content : undefined;
}

// Build localizedContent JSON for a ClauseOption if it has i18n content
function buildOptionLocalizedContent(option: ClauseOption): Record<string, unknown> | undefined {
  const content: Record<string, unknown> = {};
  let hasLocalized = false;

  if (isLocalized(option.label)) { content.label = option.label; hasLocalized = true; }
  if (isLocalized(option.plainDescription)) { content.plainDescription = option.plainDescription; hasLocalized = true; }
  if (isLocalized(option.prosPartyA)) { content.prosPartyA = option.prosPartyA; hasLocalized = true; }
  if (isLocalized(option.consPartyA)) { content.consPartyA = option.consPartyA; hasLocalized = true; }
  if (isLocalized(option.prosPartyB)) { content.prosPartyB = option.prosPartyB; hasLocalized = true; }
  if (isLocalized(option.consPartyB)) { content.consPartyB = option.consPartyB; hasLocalized = true; }
  if (isLocalized(option.legalText)) { content.legalText = option.legalText; hasLocalized = true; }

  return hasLocalized ? content : undefined;
}

// Infer supported jurisdictions from jurisdictionConfig across all clause options
function inferJurisdictionsFromClauses(data: SkillClauses): string[] {
  const jurisdictions = new Set<string>();
  for (const clause of data.clauses) {
    for (const option of clause.options) {
      if (option.jurisdictionConfig) {
        for (const key of Object.keys(option.jurisdictionConfig)) {
          jurisdictions.add(key);
        }
      }
    }
  }
  return jurisdictions.size > 0 ? Array.from(jurisdictions) : [];
}

// Infer supported languages from first clause option's label
function inferLanguagesFromClauses(data: SkillClauses): string[] {
  for (const clause of data.clauses) {
    for (const option of clause.options) {
      if (isLocalized(option.label)) {
        return Object.keys(option.label as Record<string, string>);
      }
    }
  }
  return ["en"];
}

async function main() {
  console.log("Starting database seed...");

  // Build combined skill entries: scan built-in skills first, then external/proprietary
  const skillEntries: { name: string; path: string }[] = [];

  // 1. Built-in skills (repo root /skills/)
  if (fs.existsSync(BUILTIN_SKILLS_DIR)) {
    const builtinDirs = fs.readdirSync(BUILTIN_SKILLS_DIR).filter((dir) => {
      const fullPath = path.join(BUILTIN_SKILLS_DIR, dir);
      return fs.statSync(fullPath).isDirectory();
    });
    for (const dir of builtinDirs) {
      skillEntries.push({ name: dir, path: path.join(BUILTIN_SKILLS_DIR, dir) });
    }
    console.log(`Found ${builtinDirs.length} built-in skills: ${builtinDirs.join(", ")}`);
  }

  // 2. External/proprietary skills (SKILLS_DIR env var)
  if (SKILLS_DIR && fs.existsSync(SKILLS_DIR)) {
    const externalDirs = fs.readdirSync(SKILLS_DIR).filter((dir) => {
      const fullPath = path.join(SKILLS_DIR, dir);
      return fs.statSync(fullPath).isDirectory();
    });
    for (const dir of externalDirs) {
      // External skills override built-in skills with same name
      const existingIdx = skillEntries.findIndex((e) => e.name === dir);
      if (existingIdx >= 0) {
        skillEntries[existingIdx] = { name: dir, path: path.join(SKILLS_DIR, dir) };
      } else {
        skillEntries.push({ name: dir, path: path.join(SKILLS_DIR, dir) });
      }
    }
    console.log(`Found ${externalDirs.length} external skills: ${externalDirs.join(", ")}`);
  } else if (!SKILLS_DIR) {
    console.log("No SKILLS_DIR set — seeding built-in skills only");
  }

  console.log(`Total skills to process: ${skillEntries.length}`);

  for (const entry of skillEntries) {
    const skillPath = entry.path;
    const clausesPath = path.join(skillPath, "clauses.json");
    const metadataPath = path.join(skillPath, "metadata.json");
    const manifestPath = path.join(skillPath, "manifest.json");
    const boilerplatePath = path.join(skillPath, "boilerplate.json");

    if (!fs.existsSync(clausesPath)) {
      console.log(`Skipping ${entry.name}: no clauses.json found`);
      continue;
    }

    console.log(`Processing skill: ${entry.name}`);

    const clausesData: SkillClauses = JSON.parse(
      fs.readFileSync(clausesPath, "utf-8")
    );

    let metadata: SkillMetadata | null = null;
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    }

    let manifest: SkillManifest | null = null;
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    }

    let boilerplate: Record<string, unknown> | null = null;
    if (fs.existsSync(boilerplatePath)) {
      boilerplate = JSON.parse(fs.readFileSync(boilerplatePath, "utf-8"));
    }

    // Create or update SkillPackage if manifest exists (enables licensing)
    let skillPackage = null;
    if (manifest) {
      // Generate package hash from clauses content
      const clausesContent = fs.readFileSync(clausesPath, "utf-8");
      const packageHash = crypto.createHash("sha256").update(clausesContent).digest("hex");

      skillPackage = await prisma.skillPackage.upsert({
        where: { skillId: manifest.skillId },
        create: {
          skillId: manifest.skillId,
          name: manifest.name,
          displayName: manifest.displayName,
          version: manifest.version,
          packageHash,
          jurisdictions: manifest.jurisdictions,
          languages: manifest.languages,
          isActive: true,
        },
        update: {
          name: manifest.name,
          displayName: manifest.displayName,
          version: manifest.version,
          packageHash,
          jurisdictions: manifest.jurisdictions,
          languages: manifest.languages,
        },
      });
      console.log(`  Created/updated SkillPackage: ${skillPackage.skillId} (licensing enabled)`);
    }

    // Resolve jurisdictions and languages from metadata/manifest or infer from clauses
    const jurisdictions =
      metadata?.jurisdictions || manifest?.jurisdictions || inferJurisdictionsFromClauses(clausesData);
    const languages =
      metadata?.languages || manifest?.languages || inferLanguagesFromClauses(clausesData);

    // Build localized display name/description if they are objects
    const displayNameLocalized = isLocalized(clausesData.displayName)
      ? clausesData.displayName
      : metadata?.displayName && isLocalized(metadata.displayName)
        ? metadata.displayName
        : undefined;

    const descriptionLocalized = metadata?.description && isLocalized(metadata.description)
      ? metadata.description
      : isLocalized(clausesData.description)
        ? clausesData.description
        : undefined;

    const resolvedDisplayName = resolveString(clausesData.displayName) || resolveString(metadata?.displayName) || entry.name.toUpperCase();
    const resolvedDescription = resolveString(metadata?.description) || resolveString(clausesData.description);

    // Resolve category from metadata
    const categoryLocalized = metadata?.category && isLocalized(metadata.category)
      ? metadata.category : undefined;
    const resolvedCategory = resolveString(metadata?.category) || null;

    // Create or update contract template
    const template = await prisma.contractTemplate.upsert({
      where: { contractType: clausesData.contractType },
      create: {
        contractType: clausesData.contractType,
        displayName: resolvedDisplayName,
        description: resolvedDescription,
        version: clausesData.version || metadata?.version || "1.0",
        skillPath: skillPath,
        skillPackageId: skillPackage?.id,
        templateFamily: manifest?.templateFamily || null,
        nativeJurisdiction: manifest?.nativeJurisdiction as any || null,
        boilerplate: boilerplate as Prisma.InputJsonValue ?? Prisma.DbNull,
        jurisdictions,
        languages,
        displayNameLocalized: displayNameLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
        descriptionLocalized: descriptionLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
        category: resolvedCategory,
        categoryLocalized: categoryLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
        isActive: true,
      },
      update: {
        displayName: resolvedDisplayName,
        description: resolvedDescription,
        version: clausesData.version || metadata?.version,
        skillPath: skillPath,
        skillPackageId: skillPackage?.id,
        templateFamily: manifest?.templateFamily || null,
        nativeJurisdiction: manifest?.nativeJurisdiction as any || null,
        boilerplate: boilerplate as Prisma.InputJsonValue ?? Prisma.DbNull,
        jurisdictions,
        languages,
        displayNameLocalized: displayNameLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
        descriptionLocalized: descriptionLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
        category: resolvedCategory,
        categoryLocalized: categoryLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
      },
    });

    console.log(`  Created/updated template: ${template.displayName}${skillPackage ? ' (licensed)' : ' (unlicensed)'}`);

    // Create or update clauses
    for (const clause of clausesData.clauses) {
      const clauseLocalized = buildClauseLocalizedContent(clause);

      const clauseTemplate = await prisma.clauseTemplate.upsert({
        where: {
          contractTemplateId_clauseId: {
            contractTemplateId: template.id,
            clauseId: clause.id,
          },
        },
        create: {
          contractTemplateId: template.id,
          clauseId: clause.id,
          title: resolveString(clause.title),
          category: clause.category,
          order: clause.order,
          plainDescription: resolveString(clause.plainDescription),
          legalContext: resolveString(clause.legalContext),
          isRequired: clause.isRequired ?? true,
          localizedContent: clauseLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
        },
        update: {
          title: resolveString(clause.title),
          category: clause.category,
          order: clause.order,
          plainDescription: resolveString(clause.plainDescription),
          legalContext: resolveString(clause.legalContext),
          isRequired: clause.isRequired ?? true,
          localizedContent: clauseLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
        },
      });

      // Create or update options
      for (const option of clause.options) {
        const optionLocalized = buildOptionLocalizedContent(option);

        await prisma.clauseOption.upsert({
          where: {
            clauseTemplateId_optionId: {
              clauseTemplateId: clauseTemplate.id,
              optionId: option.id,
            },
          },
          create: {
            clauseTemplateId: clauseTemplate.id,
            optionId: option.id,
            code: option.code,
            label: resolveString(option.label),
            order: option.order,
            plainDescription: resolveString(option.plainDescription),
            prosPartyA: resolveArray(option.prosPartyA),
            consPartyA: resolveArray(option.consPartyA),
            prosPartyB: resolveArray(option.prosPartyB),
            consPartyB: resolveArray(option.consPartyB),
            legalText: resolveString(option.legalText),
            biasPartyA: option.biasPartyA,
            biasPartyB: option.biasPartyB,
            jurisdictionConfig: option.jurisdictionConfig as Prisma.InputJsonValue | undefined,
            localizedContent: optionLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
          },
          update: {
            code: option.code,
            label: resolveString(option.label),
            order: option.order,
            plainDescription: resolveString(option.plainDescription),
            prosPartyA: resolveArray(option.prosPartyA),
            consPartyA: resolveArray(option.consPartyA),
            prosPartyB: resolveArray(option.prosPartyB),
            consPartyB: resolveArray(option.consPartyB),
            legalText: resolveString(option.legalText),
            biasPartyA: option.biasPartyA,
            biasPartyB: option.biasPartyB,
            jurisdictionConfig: option.jurisdictionConfig as Prisma.InputJsonValue | undefined,
            localizedContent: optionLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
          },
        });
      }

      console.log(`    - ${resolveString(clause.title)} (${clause.options.length} options)`);
    }

    // Process clause mappings if file exists
    const mappingsPath = path.join(skillPath, "clause-mappings.json");
    if (fs.existsSync(mappingsPath)) {
      const mappingsData: ClauseMappingsFile = JSON.parse(
        fs.readFileSync(mappingsPath, "utf-8")
      );
      console.log(`  Processing clause mappings: ${mappingsData.family} (${mappingsData.mappings.length} mappings)`);

      // Resolve source and target template IDs
      const sourceTemplate = await prisma.contractTemplate.findUnique({
        where: { contractType: mappingsData.sourceTemplate },
      });
      const targetTemplate = await prisma.contractTemplate.findUnique({
        where: { contractType: mappingsData.targetTemplate },
      });

      if (sourceTemplate && targetTemplate) {
        for (const mapping of mappingsData.mappings) {
          // For "new" type mappings, sourceClauseId is the targetClauseId (self-referencing)
          const sourceClauseId = mapping.source || mapping.target;
          await prisma.clauseMapping.upsert({
            where: {
              familyKey_sourceClauseId_targetClauseId: {
                familyKey: mappingsData.family,
                sourceClauseId,
                targetClauseId: mapping.target,
              },
            },
            create: {
              familyKey: mappingsData.family,
              sourceClauseId,
              targetClauseId: mapping.target,
              sourceTemplateId: sourceTemplate.id,
              targetTemplateId: targetTemplate.id,
              mappingType: mapping.type,
              notes: mapping.notes || null,
            },
            update: {
              sourceTemplateId: sourceTemplate.id,
              targetTemplateId: targetTemplate.id,
              mappingType: mapping.type,
              notes: mapping.notes || null,
            },
          });
        }
        console.log(`    Synced ${mappingsData.mappings.length} clause mappings`);
      } else {
        console.warn(`    Could not resolve templates for mappings: source=${mappingsData.sourceTemplate} target=${mappingsData.targetTemplate}`);
      }
    }
  }

  // ── Mark licensed skills as premium + set Stripe price ──
  const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || null;
  const STRIPE_PRICE_VETTED = process.env.STRIPE_PRICE_VETTED || STRIPE_PRICE_ID;
  const premiumSkillIds = [
    "com.nel.skills.founders",
    "com.nel.skills.safe",
    "com.nel.skills.pacto-socios",
    "com.nel.skills.employment",
    "com.nel.skills.consulting",
    "com.nel.skills.shareholders",
    "com.nel.skills.convertible-note",
    "com.nel.skills.ip-assignment",
    "com.nel.skills.term-sheet",
  ];

  for (const skillId of premiumSkillIds) {
    const existing = await prisma.skillPackage.findUnique({ where: { skillId } });
    if (existing) {
      await prisma.skillPackage.update({
        where: { skillId },
        data: {
          isPremium: true,
          stripePriceId: STRIPE_PRICE_ID,
          priceAmount: 900,
          priceCurrency: "eur",
        },
      });
      console.log(`  Marked ${skillId} as premium (€9/mo)`);
    }
  }

  // ── Upsert "Vetted Contracts" feature package ──
  await prisma.skillPackage.upsert({
    where: { skillId: "com.nel.features.vetted-contracts" },
    create: {
      skillId: "com.nel.features.vetted-contracts",
      name: "vetted-contracts",
      displayName: "Vetted Contracts",
      version: "1.0.0",
      packageHash: crypto.createHash("sha256").update("vetted-contracts").digest("hex"),
      jurisdictions: [],
      languages: ["en", "es"],
      isPremium: true,
      stripePriceId: STRIPE_PRICE_VETTED,
      priceAmount: 900,
      priceCurrency: "eur",
      description: "Send attorney-vetted contract templates to clients via email invitation",
      isActive: true,
    },
    update: {
      displayName: "Vetted Contracts",
      isPremium: true,
      stripePriceId: STRIPE_PRICE_VETTED,
      priceAmount: 900,
      priceCurrency: "eur",
      description: "Send attorney-vetted contract templates to clients via email invitation",
    },
  });
  console.log("  Created/updated Vetted Contracts feature package");

  console.log("\nSeed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
