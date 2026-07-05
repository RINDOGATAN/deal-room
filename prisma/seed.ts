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
  soloModeSupported?: boolean;
  soloModeDefault?: boolean;
  soloModeOnly?: boolean;
  templateFamily?: string;
}

interface SkillManifestAuthor {
  name: string;
  email?: string;
  stripeConnectAccountId?: string;
}

interface SkillManifest {
  skillId: string;
  name: string;
  displayName: string;
  version: string;
  jurisdictions: string[];
  languages: string[];
  author?: string | SkillManifestAuthor;
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
  category: LocalizedString;
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
  if (isLocalized(clause.category)) { content.category = clause.category; hasLocalized = true; }
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
      if (dir.startsWith(".") || dir.startsWith("_")) return false;
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
    const parametersPath = path.join(skillPath, "parameters.json");

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

    let parameterSchema: Record<string, unknown> | null = null;
    if (fs.existsSync(parametersPath)) {
      parameterSchema = JSON.parse(fs.readFileSync(parametersPath, "utf-8"));
      console.log(`  Found parameters.json (${(parameterSchema as any)?.parameters?.length || 0} parameters)`);
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

      // Sync publisher info from manifest author object (written by Clausemaster on export)
      const authorObj = manifest.author && typeof manifest.author === "object" ? manifest.author : null;
      if (authorObj?.email) {
        // Find the user by email to link as author
        const authorUser = await prisma.user.findUnique({
          where: { email: authorObj.email },
          select: { id: true },
        });

        if (authorUser) {
          // Set authorId on SkillPackage
          await prisma.skillPackage.update({
            where: { id: skillPackage.id },
            data: { authorId: authorUser.id },
          });
          console.log(`  Linked author: ${authorObj.email}`);

          // Sync stripeConnectAccountId to LawyerProfile if provided
          if (authorObj.stripeConnectAccountId) {
            await prisma.lawyerProfile.updateMany({
              where: { userId: authorUser.id },
              data: { stripeConnectAccountId: authorObj.stripeConnectAccountId },
            });
            console.log(`  Synced Stripe Connect account for ${authorObj.email}`);
          }
        }
      }
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
        templateFamily: manifest?.templateFamily || metadata?.templateFamily || null,
        nativeJurisdiction: manifest?.nativeJurisdiction as any || null,
        boilerplate: boilerplate as Prisma.InputJsonValue ?? Prisma.DbNull,
        jurisdictions,
        languages,
        displayNameLocalized: displayNameLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
        descriptionLocalized: descriptionLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
        category: resolvedCategory,
        categoryLocalized: categoryLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
        parameterSchema: parameterSchema as Prisma.InputJsonValue ?? Prisma.DbNull,
        soloModeSupported: metadata?.soloModeSupported ?? false,
        soloModeDefault: metadata?.soloModeDefault ?? false,
        soloModeOnly: metadata?.soloModeOnly ?? false,
        isActive: true,
      },
      update: {
        displayName: resolvedDisplayName,
        description: resolvedDescription,
        version: clausesData.version || metadata?.version,
        skillPath: skillPath,
        skillPackageId: skillPackage?.id,
        templateFamily: manifest?.templateFamily || metadata?.templateFamily || null,
        nativeJurisdiction: manifest?.nativeJurisdiction as any || null,
        boilerplate: boilerplate as Prisma.InputJsonValue ?? Prisma.DbNull,
        jurisdictions,
        languages,
        displayNameLocalized: displayNameLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
        descriptionLocalized: descriptionLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
        category: resolvedCategory,
        categoryLocalized: categoryLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
        parameterSchema: parameterSchema as Prisma.InputJsonValue ?? Prisma.DbNull,
        soloModeSupported: metadata?.soloModeSupported ?? false,
        soloModeDefault: metadata?.soloModeDefault ?? false,
        soloModeOnly: metadata?.soloModeOnly ?? false,
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
          category: resolveString(clause.category),
          order: clause.order,
          plainDescription: resolveString(clause.plainDescription),
          legalContext: resolveString(clause.legalContext),
          isRequired: clause.isRequired ?? true,
          localizedContent: clauseLocalized as Prisma.InputJsonValue ?? Prisma.DbNull,
        },
        update: {
          title: resolveString(clause.title),
          category: resolveString(clause.category),
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
            biasPartyA: option.biasPartyA ?? 0,
            biasPartyB: option.biasPartyB ?? 0,
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
            biasPartyA: option.biasPartyA ?? 0,
            biasPartyB: option.biasPartyB ?? 0,
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
    "com.nel.skills.contrato-laboral",
    "com.nel.skills.contrato-servicios",
    "com.nel.skills.cesion-pi",
    "com.nel.skills.acta-junta",
    "com.nel.skills.acta-consejo",
    "com.nel.skills.phantom-shares-plan",
    "com.nel.skills.phantom-shares-grant",
    "com.nel.skills.advertising-io",
    "com.nel.skills.affiliate-program",
    "com.nel.skills.data-licensing",
    "com.nel.skills.influencer-marketing",
    "com.nel.skills.seed-investment",
    "com.nel.skills.white-label-reseller",
    "com.nel.skills.advisory",
    "com.nel.skills.technology-license",
    "com.nel.skills.joint-venture",
    "com.nel.skills.software-development",
    "com.nel.skills.equity-incentive",
  ];

  // A2A contract skills — bundled under the A2A subscription
  const a2aSkillIds = [
    "com.todolaw.skills.a2a.api-access",
    "com.todolaw.skills.a2a.tool-license",
    "com.todolaw.skills.a2a.data-sharing",
    "com.todolaw.skills.a2a.compute-procurement",
    "com.todolaw.skills.a2a.task-delegation",
    "com.todolaw.skills.a2a.content-license",
    "com.todolaw.skills.a2a.marketplace",
    "com.todolaw.skills.a2a.orchestration",
    "com.todolaw.skills.a2a.payment-authorization",
    "com.todolaw.skills.a2a.knowledge-access",
    "com.todolaw.skills.a2a.supply-chain",
    "com.todolaw.skills.a2a.monitoring",
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

  // Mark A2A skills as premium (bundled A2A subscription, same price)
  for (const skillId of a2aSkillIds) {
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
      console.log(`  Marked ${skillId} as premium A2A skill (€9/mo)`);
    }
  }

  // ── Retire "Vetted Contracts" feature package ──
  // The lawyer contract-vetting flow was removed 2026-07 with the lawyer-expert
  // directory. Deactivate the package (rather than delete it) so existing
  // entitlement rows keep their audit trail while the plan disappears from the
  // billing catalog (getAvailablePlans filters on isActive).
  const vettedPkg = await prisma.skillPackage.findUnique({
    where: { skillId: "com.nel.features.vetted-contracts" },
  });
  if (vettedPkg && vettedPkg.isActive) {
    await prisma.skillPackage.update({
      where: { skillId: "com.nel.features.vetted-contracts" },
      data: { isActive: false },
    });
    console.log("  Deactivated retired Vetted Contracts feature package");
  }

  // ── Seed pre-approved supervisory attorney (fictional fixture) ──
  const supervisor = await prisma.supervisor.upsert({
    where: { email: "alex@example-firm.test" },
    create: {
      email: "alex@example-firm.test",
      name: "Alex Ferris (#000000 State Bar of California)",
      isActive: true,
    },
    update: {
      name: "Alex Ferris (#000000 State Bar of California)",
      isActive: true,
    },
  });
  console.log("  Created/updated Supervisor: Alex Ferris");

  // Seed bar admissions for the supervisor
  await prisma.supervisorBarAdmission.upsert({
    where: {
      supervisorId_jurisdiction: {
        supervisorId: supervisor.id,
        jurisdiction: "CALIFORNIA",
      },
    },
    create: {
      supervisorId: supervisor.id,
      jurisdiction: "CALIFORNIA",
      barNumber: "000000",
    },
    update: {
      barNumber: "000000",
    },
  });
  await prisma.supervisorBarAdmission.upsert({
    where: {
      supervisorId_jurisdiction: {
        supervisorId: supervisor.id,
        jurisdiction: "SPAIN",
      },
    },
    create: {
      supervisorId: supervisor.id,
      jurisdiction: "SPAIN",
      barNumber: "ICAM-00000",
    },
    update: {
      barNumber: "ICAM-00000",
    },
  });
  console.log("  Created/updated bar admissions: CALIFORNIA (#000000), SPAIN (ICAM-00000)");

  // NOTE (2026-07): the three LEGAL expert seed profiles were removed with the
  // lawyer-expert directory. Any legacy LEGAL rows in production are handled
  // by a manual data step (deactivate + strip LEGAL from expertTypes) — see
  // the removal plan.

  // ── Seed first Deployment expert (fictional fixture) ──
  const deploymentExpertA = await prisma.user.upsert({
    where: { email: "jordan.vale@example-consulting.test" },
    create: {
      email: "jordan.vale@example-consulting.test",
      name: "Jordan Vale",
      company: "Example Consulting",
      isLawyer: true,
      role: "LAWYER",
    },
    update: {
      name: "Jordan Vale",
      company: "Example Consulting",
      isLawyer: true,
      role: "LAWYER",
    },
  });
  await prisma.lawyerProfile.upsert({
    where: { userId: deploymentExpertA.id },
    create: {
      userId: deploymentExpertA.id,
      title: "Deployment Consultant",
      bio: "Self-hosting and deployment specialist covering EU, US, and UK environments.",
      jurisdictions: [],
      languages: ["en", "es"],
      expertTypes: ["DEPLOYMENT"],
      specializations: ["SELF_HOSTING_DEPLOYMENT"],
      certifications: [],
      countryCode: "GB",
      city: "London",
      jurisdictionsCovered: ["EU", "US", "UK"],
      acceptingClients: true,
      isPublished: true,
    },
    update: {
      title: "Deployment Consultant",
      languages: ["en", "es"],
      expertTypes: ["DEPLOYMENT"],
      specializations: ["SELF_HOSTING_DEPLOYMENT"],
      countryCode: "GB",
      city: "London",
      jurisdictionsCovered: ["EU", "US", "UK"],
      isPublished: true,
    },
  });
  console.log("  Created/updated LawyerProfile: Jordan Vale (Deployment)");

  // ── Seed second Deployment expert (fictional fixture) ──
  // notifyEmails exercises the additional-notification-recipients path.
  const deploymentExpertB = await prisma.user.upsert({
    where: { email: "sam.porter@example-deploy.test" },
    create: {
      email: "sam.porter@example-deploy.test",
      name: "Sam Porter",
      company: "Example Deploy Co",
      isLawyer: true,
      role: "LAWYER",
    },
    update: {
      name: "Sam Porter",
      company: "Example Deploy Co",
      isLawyer: true,
      role: "LAWYER",
    },
  });
  await prisma.lawyerProfile.upsert({
    where: { userId: deploymentExpertB.id },
    create: {
      userId: deploymentExpertB.id,
      title: "Deployment Consultant",
      bio: "Self-hosting and deployment specialist covering EU, US, and UK environments.",
      jurisdictions: [],
      languages: ["en", "es"],
      expertTypes: ["DEPLOYMENT"],
      specializations: ["SELF_HOSTING_DEPLOYMENT"],
      certifications: [],
      countryCode: "GB",
      city: "London",
      jurisdictionsCovered: ["EU", "US", "UK"],
      acceptingClients: true,
      isPublished: true,
      notifyEmails: ["jordan.vale@example-consulting.test"],
    },
    update: {
      title: "Deployment Consultant",
      languages: ["en", "es"],
      expertTypes: ["DEPLOYMENT"],
      specializations: ["SELF_HOSTING_DEPLOYMENT"],
      countryCode: "GB",
      city: "London",
      jurisdictionsCovered: ["EU", "US", "UK"],
      isPublished: true,
      notifyEmails: ["jordan.vale@example-consulting.test"],
    },
  });
  console.log("  Created/updated LawyerProfile: Sam Porter (Deployment)");

  // ── Seed sample invite codes for northend.law brand ──
  if (process.env.NEXT_PUBLIC_BRAND === "northend") {
    // Create a demo customer if none exists
    const demoCustomer = await prisma.customer.upsert({
      where: { email: "demo@example.test" },
      create: {
        name: "Demo Law Firm",
        email: "demo@example.test",
        type: "SAAS",
      },
      update: {},
    });

    // Create sample invite codes
    const sampleCodes = ["DEMO-0001", "DEMO-0002", "DEMO-0003"];
    for (const code of sampleCodes) {
      await prisma.inviteCode.upsert({
        where: { code },
        create: {
          code,
          customerId: demoCustomer.id,
        },
        update: {},
      });
    }
    console.log(`  Created sample invite codes for northend.law: ${sampleCodes.join(", ")}`);
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
