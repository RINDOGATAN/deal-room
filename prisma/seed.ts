import { Prisma, PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const SKILLS_DIR = process.env.SKILLS_DIR || "/Users/sme/NEL/legalskills";

interface SkillMetadata {
  contractType: string;
  displayName: string;
  description?: string;
  version: string;
  clauseCount: number;
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
  label: string;
  order: number;
  plainDescription: string;
  prosPartyA: string[];
  consPartyA: string[];
  prosPartyB: string[];
  consPartyB: string[];
  legalText: string;
  biasPartyA: number;
  biasPartyB: number;
  jurisdictionConfig?: JurisdictionConfig;
}

interface Clause {
  id: string;
  title: string;
  category: string;
  order: number;
  plainDescription: string;
  legalContext?: string;
  isRequired?: boolean;
  options: ClauseOption[];
}

interface SkillClauses {
  contractType: string;
  displayName: string;
  version: string;
  clauses: Clause[];
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

    // Create or update contract template
    const template = await prisma.contractTemplate.upsert({
      where: { contractType: clausesData.contractType },
      create: {
        contractType: clausesData.contractType,
        displayName: clausesData.displayName || metadata?.displayName || skillDir.toUpperCase(),
        description: metadata?.description,
        version: clausesData.version || metadata?.version || "1.0",
        skillPath: skillPath,
        isActive: true,
      },
      update: {
        displayName: clausesData.displayName || metadata?.displayName,
        description: metadata?.description,
        version: clausesData.version || metadata?.version,
        skillPath: skillPath,
      },
    });

    console.log(`  Created/updated template: ${template.displayName}`);

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
          title: clause.title,
          category: clause.category,
          order: clause.order,
          plainDescription: clause.plainDescription,
          legalContext: clause.legalContext,
          isRequired: clause.isRequired ?? true,
        },
        update: {
          title: clause.title,
          category: clause.category,
          order: clause.order,
          plainDescription: clause.plainDescription,
          legalContext: clause.legalContext,
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
            label: option.label,
            order: option.order,
            plainDescription: option.plainDescription,
            prosPartyA: option.prosPartyA,
            consPartyA: option.consPartyA,
            prosPartyB: option.prosPartyB,
            consPartyB: option.consPartyB,
            legalText: option.legalText,
            biasPartyA: option.biasPartyA,
            biasPartyB: option.biasPartyB,
            jurisdictionConfig: option.jurisdictionConfig as Prisma.InputJsonValue | undefined,
          },
          update: {
            code: option.code,
            label: option.label,
            order: option.order,
            plainDescription: option.plainDescription,
            prosPartyA: option.prosPartyA,
            consPartyA: option.consPartyA,
            prosPartyB: option.prosPartyB,
            consPartyB: option.consPartyB,
            legalText: option.legalText,
            biasPartyA: option.biasPartyA,
            biasPartyB: option.biasPartyB,
            jurisdictionConfig: option.jurisdictionConfig as Prisma.InputJsonValue | undefined,
          },
        });
      }

      console.log(`    - ${clause.title} (${clause.options.length} options)`);
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
