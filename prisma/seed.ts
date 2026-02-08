import { Prisma, PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const prisma = new PrismaClient();

const SKILLS_DIR = process.env.SKILLS_DIR || "/Users/sme/NEL/legalskills";

interface SkillMetadata {
  contractType: string;
  displayName: string;
  description?: string;
  version: string;
  clauseCount: number;
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

async function main() {
  console.log("Starting database seed...");

  // Find all skill directories
  const skillDirs = fs.readdirSync(SKILLS_DIR).filter((dir) => {
    const fullPath = path.join(SKILLS_DIR, dir);
    return fs.statSync(fullPath).isDirectory();
  });

  console.log(`Found ${skillDirs.length} skill directories: ${skillDirs.join(", ")}`);

  for (const skillDir of skillDirs) {
    const skillPath = path.join(SKILLS_DIR, skillDir);
    const clausesPath = path.join(skillPath, "clauses.json");
    const metadataPath = path.join(skillPath, "metadata.json");
    const manifestPath = path.join(skillPath, "manifest.json");

    if (!fs.existsSync(clausesPath)) {
      console.log(`Skipping ${skillDir}: no clauses.json found`);
      continue;
    }

    console.log(`Processing skill: ${skillDir}`);

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

    // Create or update contract template
    const template = await prisma.contractTemplate.upsert({
      where: { contractType: clausesData.contractType },
      create: {
        contractType: clausesData.contractType,
        displayName: resolveString(clausesData.displayName) || metadata?.displayName || skillDir.toUpperCase(),
        description: metadata?.description,
        version: clausesData.version || metadata?.version || "1.0",
        skillPath: skillPath,
        skillPackageId: skillPackage?.id,
        templateFamily: manifest?.templateFamily || null,
        nativeJurisdiction: manifest?.nativeJurisdiction as any || null,
        isActive: true,
      },
      update: {
        displayName: resolveString(clausesData.displayName) || metadata?.displayName,
        description: metadata?.description,
        version: clausesData.version || metadata?.version,
        skillPath: skillPath,
        skillPackageId: skillPackage?.id,
        templateFamily: manifest?.templateFamily || null,
        nativeJurisdiction: manifest?.nativeJurisdiction as any || null,
      },
    });

    console.log(`  Created/updated template: ${template.displayName}${skillPackage ? ' (licensed)' : ' (unlicensed)'}`);

    // Create or update clauses
    for (const clause of clausesData.clauses) {
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
        },
        update: {
          title: resolveString(clause.title),
          category: clause.category,
          order: clause.order,
          plainDescription: resolveString(clause.plainDescription),
          legalContext: resolveString(clause.legalContext),
          isRequired: clause.isRequired ?? true,
        },
      });

      // Create or update options
      for (const option of clause.options) {
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
