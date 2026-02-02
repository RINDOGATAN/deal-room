import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import {
  resolveLocalizedString,
  resolveLocalizedArray,
  type LocalizedString,
  type LocalizedStringArray,
} from "./i18n";

// Skills directory path - can be configured via env
const SKILLS_DIR = process.env.SKILLS_DIR || path.join(process.cwd(), "data/skills");
const INSTALLED_SKILLS_DIR = process.env.INSTALLED_SKILLS_DIR || path.join(process.cwd(), "data/skills/installed");

// Default language for resolving i18n content
const DEFAULT_LANGUAGE = process.env.DEFAULT_LANGUAGE || "en";

// ============================================================
// I18N-AWARE SCHEMA HELPERS
// ============================================================

// Localized string: either a plain string or an object with language codes
const LocalizedStringSchema = z.union([
  z.string(),
  z.record(z.string(), z.string()),
]);

// Localized string array: either an array or an object with language codes
const LocalizedStringArraySchema = z.union([
  z.array(z.string()),
  z.record(z.string(), z.array(z.string())),
]);

// ============================================================
// SCHEMA DEFINITIONS (with i18n support)
// ============================================================

// Legacy format (flat strings)
const LegacyClauseOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  order: z.number(),
  plainDescription: z.string(),
  prosPartyA: z.array(z.string()),
  consPartyA: z.array(z.string()),
  prosPartyB: z.array(z.string()),
  consPartyB: z.array(z.string()),
  legalText: z.string(),
  biasPartyA: z.number().min(-1).max(1),
  biasPartyB: z.number().min(-1).max(1),
  jurisdictionConfig: z.record(z.string(), z.any()).optional(),
});

// New i18n format (nested pros/cons with localized strings)
const I18nClauseOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: LocalizedStringSchema,
  order: z.number(),
  plainDescription: LocalizedStringSchema,
  pros: z.object({
    partyA: LocalizedStringArraySchema,
    partyB: LocalizedStringArraySchema,
  }),
  cons: z.object({
    partyA: LocalizedStringArraySchema,
    partyB: LocalizedStringArraySchema,
  }),
  legalText: LocalizedStringSchema,
  bias: z.object({
    partyA: z.number().min(-1).max(1),
    partyB: z.number().min(-1).max(1),
  }),
  jurisdictionConfig: z.record(z.string(), z.any()).optional(),
});

// Accept either format
const ClauseOptionSchema = z.union([LegacyClauseOptionSchema, I18nClauseOptionSchema]);

// Legacy clause schema
const LegacyClauseSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  order: z.number(),
  plainDescription: z.string(),
  legalContext: z.string().optional(),
  isRequired: z.boolean().optional().default(true),
  options: z.array(LegacyClauseOptionSchema).min(3),
});

// I18n clause schema
const I18nClauseSchema = z.object({
  id: z.string(),
  title: LocalizedStringSchema,
  category: z.string(),
  order: z.number(),
  plainDescription: LocalizedStringSchema,
  legalContext: LocalizedStringSchema.optional(),
  isRequired: z.boolean().optional().default(true),
  options: z.array(I18nClauseOptionSchema).min(3),
});

const ClauseSchema = z.union([LegacyClauseSchema, I18nClauseSchema]);

// Legacy clauses file
const LegacyClausesFileSchema = z.object({
  contractType: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  version: z.string().optional().default("1.0"),
  clauses: z.array(LegacyClauseSchema),
});

// I18n clauses file
const I18nClausesFileSchema = z.object({
  contractType: z.string(),
  displayName: LocalizedStringSchema,
  description: LocalizedStringSchema.optional(),
  version: z.string().optional().default("1.0"),
  languages: z.array(z.string()).optional(),
  clauses: z.array(I18nClauseSchema),
});

const ClausesFileSchema = z.union([LegacyClausesFileSchema, I18nClausesFileSchema]);

const MetadataSchema = z.object({
  contractType: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  version: z.string().optional().default("1.0"),
  clauseCount: z.number().optional(),
});

// Boilerplate schema for standard contract sections
const DefinitionSchema = z.object({
  term: z.string(),
  definition: z.string(),
});

const StandardClauseSchema = z.object({
  title: z.string(),
  text: z.string(),
});

const JurisdictionProvisionSchema = z.object({
  title: z.string(),
  text: z.string(),
});

const BoilerplateSchema = z.object({
  contractTitle: z.string(),
  preamble: z.string(),
  background: z.string().optional(),
  definitions: z.array(DefinitionSchema),
  standardClauses: z.array(StandardClauseSchema),
  generalProvisions: z.array(StandardClauseSchema),
  jurisdictionProvisions: z.record(z.string(), JurisdictionProvisionSchema),
  signatureBlock: z.string(),
});

export type ClausesFile = z.infer<typeof ClausesFileSchema>;
export type SkillMetadata = z.infer<typeof MetadataSchema>;
export type Boilerplate = z.infer<typeof BoilerplateSchema>;

// ============================================================
// I18N CONTENT NORMALIZATION
// ============================================================

interface NormalizedClauseOption {
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
  jurisdictionConfig?: Record<string, unknown>;
}

interface NormalizedClause {
  id: string;
  title: string;
  category: string;
  order: number;
  plainDescription: string;
  legalContext?: string;
  isRequired: boolean;
  options: NormalizedClauseOption[];
}

interface NormalizedClausesFile {
  contractType: string;
  displayName: string;
  description?: string;
  version: string;
  clauses: NormalizedClause[];
}

/**
 * Check if an option uses the i18n format (has pros/cons objects)
 */
function isI18nOption(option: unknown): boolean {
  return (
    typeof option === "object" &&
    option !== null &&
    "pros" in option &&
    "cons" in option &&
    "bias" in option
  );
}

/**
 * Normalize a clause option to the flat format for database storage.
 * Resolves i18n content to the specified language.
 */
function normalizeOption(
  option: unknown,
  language: string = DEFAULT_LANGUAGE
): NormalizedClauseOption {
  const opt = option as Record<string, unknown>;

  if (isI18nOption(option)) {
    // New i18n format
    const pros = opt.pros as Record<string, unknown>;
    const cons = opt.cons as Record<string, unknown>;
    const bias = opt.bias as Record<string, number>;

    return {
      id: opt.id as string,
      code: opt.code as string,
      label: resolveLocalizedString(opt.label, language),
      order: opt.order as number,
      plainDescription: resolveLocalizedString(opt.plainDescription, language),
      prosPartyA: resolveLocalizedArray(pros.partyA, language),
      consPartyA: resolveLocalizedArray(cons.partyA, language),
      prosPartyB: resolveLocalizedArray(pros.partyB, language),
      consPartyB: resolveLocalizedArray(cons.partyB, language),
      legalText: resolveLocalizedString(opt.legalText, language),
      biasPartyA: bias.partyA,
      biasPartyB: bias.partyB,
      jurisdictionConfig: opt.jurisdictionConfig as Record<string, unknown> | undefined,
    };
  } else {
    // Legacy flat format
    return {
      id: opt.id as string,
      code: opt.code as string,
      label: opt.label as string,
      order: opt.order as number,
      plainDescription: opt.plainDescription as string,
      prosPartyA: opt.prosPartyA as string[],
      consPartyA: opt.consPartyA as string[],
      prosPartyB: opt.prosPartyB as string[],
      consPartyB: opt.consPartyB as string[],
      legalText: opt.legalText as string,
      biasPartyA: opt.biasPartyA as number,
      biasPartyB: opt.biasPartyB as number,
      jurisdictionConfig: opt.jurisdictionConfig as Record<string, unknown> | undefined,
    };
  }
}

/**
 * Normalize a clause to the flat format for database storage.
 */
function normalizeClause(
  clause: unknown,
  language: string = DEFAULT_LANGUAGE
): NormalizedClause {
  const c = clause as Record<string, unknown>;
  const options = c.options as unknown[];

  return {
    id: c.id as string,
    title: resolveLocalizedString(c.title, language),
    category: c.category as string,
    order: c.order as number,
    plainDescription: resolveLocalizedString(c.plainDescription, language),
    legalContext: c.legalContext
      ? resolveLocalizedString(c.legalContext, language)
      : undefined,
    isRequired: (c.isRequired as boolean) ?? true,
    options: options.map((opt) => normalizeOption(opt, language)),
  };
}

/**
 * Normalize a clauses file to the flat format for database storage.
 */
function normalizeClausesFile(
  data: unknown,
  language: string = DEFAULT_LANGUAGE
): NormalizedClausesFile {
  const file = data as Record<string, unknown>;
  const clauses = file.clauses as unknown[];

  return {
    contractType: file.contractType as string,
    displayName: resolveLocalizedString(file.displayName, language),
    description: file.description
      ? resolveLocalizedString(file.description, language)
      : undefined,
    version: (file.version as string) || "1.0",
    clauses: clauses.map((c) => normalizeClause(c, language)),
  };
}

interface SkillData {
  clauses: ClausesFile;
  boilerplate: Boilerplate | null;
}

interface SkillLoadResult {
  contractType: string;
  displayName: string;
  clauseCount: number;
  hasBoilerplate: boolean;
  status: "loaded" | "error";
  error?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Get bias value from an option (handles both legacy and i18n formats)
 */
function getOptionBias(option: Record<string, unknown>, party: "A" | "B"): number {
  // New format: bias.partyA / bias.partyB
  if (option.bias && typeof option.bias === "object") {
    const bias = option.bias as Record<string, number>;
    return party === "A" ? (bias.partyA ?? 0) : (bias.partyB ?? 0);
  }
  // Legacy format: biasPartyA / biasPartyB
  return party === "A"
    ? (option.biasPartyA as number) ?? 0
    : (option.biasPartyB as number) ?? 0;
}

/**
 * Get pros/cons array from an option (handles both legacy and i18n formats)
 */
function getOptionArray(
  option: Record<string, unknown>,
  field: "prosPartyA" | "consPartyA" | "prosPartyB" | "consPartyB"
): unknown[] {
  // Legacy format
  if (Array.isArray(option[field])) {
    return option[field] as unknown[];
  }

  // New format: pros.partyA, cons.partyA, etc.
  if (field.startsWith("pros")) {
    const pros = option.pros as Record<string, unknown> | undefined;
    const party = field.endsWith("A") ? "partyA" : "partyB";
    const val = pros?.[party];
    return Array.isArray(val) ? val : [];
  } else {
    const cons = option.cons as Record<string, unknown> | undefined;
    const party = field.endsWith("A") ? "partyA" : "partyB";
    const val = cons?.[party];
    return Array.isArray(val) ? val : [];
  }
}

/**
 * Validate a clauses.json file (supports both legacy and i18n formats)
 */
export function validateClausesFile(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const parsed = ClausesFileSchema.parse(data);
    const clauses = parsed.clauses as Array<Record<string, unknown>>;

    // Additional validation
    for (const clause of clauses) {
      const clauseTitle = resolveLocalizedString(clause.title, DEFAULT_LANGUAGE);
      const options = clause.options as Array<Record<string, unknown>>;

      // Check option count
      if (options.length < 3) {
        errors.push(`Clause "${clauseTitle}" has fewer than 3 options`);
      }

      // Check for unique option IDs
      const optionIds = new Set<string>();
      for (const option of options) {
        if (optionIds.has(option.id as string)) {
          errors.push(
            `Clause "${clauseTitle}" has duplicate option ID: ${option.id}`
          );
        }
        optionIds.add(option.id as string);

        const optionLabel = resolveLocalizedString(option.label, DEFAULT_LANGUAGE);

        // Validate bias scores
        const biasA = getOptionBias(option, "A");
        const biasB = getOptionBias(option, "B");

        if (biasA < -1 || biasA > 1) {
          errors.push(
            `Option "${optionLabel}" in "${clauseTitle}" has invalid biasPartyA: ${biasA}`
          );
        }
        if (biasB < -1 || biasB > 1) {
          errors.push(
            `Option "${optionLabel}" in "${clauseTitle}" has invalid biasPartyB: ${biasB}`
          );
        }

        // Check for pros/cons
        if (getOptionArray(option, "prosPartyA").length === 0) {
          warnings.push(
            `Option "${optionLabel}" in "${clauseTitle}" has no prosPartyA`
          );
        }
        if (getOptionArray(option, "consPartyA").length === 0) {
          warnings.push(
            `Option "${optionLabel}" in "${clauseTitle}" has no consPartyA`
          );
        }
        if (getOptionArray(option, "prosPartyB").length === 0) {
          warnings.push(
            `Option "${optionLabel}" in "${clauseTitle}" has no prosPartyB`
          );
        }
        if (getOptionArray(option, "consPartyB").length === 0) {
          warnings.push(
            `Option "${optionLabel}" in "${clauseTitle}" has no consPartyB`
          );
        }
      }

      // Check for legalContext
      if (!clause.legalContext) {
        warnings.push(`Clause "${clauseTitle}" is missing legalContext`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return {
        valid: false,
        errors: e.issues.map((err) => `${err.path.join(".")}: ${err.message}`),
        warnings,
      };
    }
    return {
      valid: false,
      errors: [String(e)],
      warnings,
    };
  }
}

/**
 * Load boilerplate from a skill directory
 */
export function loadBoilerplateFromDirectory(
  skillDir: string
): Boilerplate | null {
  const boilerplatePath = path.join(skillDir, "boilerplate.json");

  if (!fs.existsSync(boilerplatePath)) {
    console.log(`No boilerplate.json found in ${skillDir}`);
    return null;
  }

  try {
    const content = fs.readFileSync(boilerplatePath, "utf-8");
    const data = JSON.parse(content);
    const parsed = BoilerplateSchema.safeParse(data);

    if (!parsed.success) {
      console.error(`Boilerplate validation errors in ${boilerplatePath}:`);
      parsed.error.issues.forEach((err) =>
        console.error(`  - ${err.path.join(".")}: ${err.message}`)
      );
      return null;
    }

    console.log(`Loaded boilerplate from ${skillDir}`);
    return parsed.data;
  } catch (e) {
    console.error(`Error loading ${boilerplatePath}:`, e);
    return null;
  }
}

/**
 * Load a skill from a directory
 */
export function loadSkillFromDirectory(
  skillDir: string
): SkillData | null {
  const clausesPath = path.join(skillDir, "clauses.json");

  if (!fs.existsSync(clausesPath)) {
    console.log(`No clauses.json found in ${skillDir}`);
    return null;
  }

  try {
    const content = fs.readFileSync(clausesPath, "utf-8");
    const data = JSON.parse(content);
    const validation = validateClausesFile(data);

    if (!validation.valid) {
      console.error(`Validation errors in ${clausesPath}:`);
      validation.errors.forEach((err) => console.error(`  - ${err}`));
      return null;
    }

    if (validation.warnings.length > 0) {
      console.warn(`Validation warnings in ${clausesPath}:`);
      validation.warnings.forEach((warn) => console.warn(`  - ${warn}`));
    }

    // Also load boilerplate if available
    const boilerplate = loadBoilerplateFromDirectory(skillDir);

    return {
      clauses: data as ClausesFile,
      boilerplate,
    };
  } catch (e) {
    console.error(`Error loading ${clausesPath}:`, e);
    return null;
  }
}

/**
 * Scan skills directory and load all skills
 */
export function scanSkillsDirectory(): Map<string, SkillData> {
  const skills = new Map<string, SkillData>();

  if (!fs.existsSync(SKILLS_DIR)) {
    console.warn(`Skills directory not found: ${SKILLS_DIR}`);
    return skills;
  }

  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillDir = path.join(SKILLS_DIR, entry.name);
      const skillData = loadSkillFromDirectory(skillDir);
      if (skillData) {
        skills.set(skillData.clauses.contractType, skillData);
        console.log(
          `Loaded skill: ${skillData.clauses.displayName} (${skillData.clauses.clauses.length} clauses, boilerplate: ${skillData.boilerplate ? "yes" : "no"})`
        );
      }
    }
  }

  return skills;
}

/**
 * Scan installed skill packages directory
 */
export function scanInstalledSkillsDirectory(): Map<string, SkillData> {
  const skills = new Map<string, SkillData>();

  if (!fs.existsSync(INSTALLED_SKILLS_DIR)) {
    console.log(`Installed skills directory not found: ${INSTALLED_SKILLS_DIR}`);
    return skills;
  }

  // Installed skills are in nested directories: com/nel/skills/nda/content/
  const scanRecursive = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = path.join(dir, entry.name);

        // Check if this directory has content/clauses.json
        const contentDir = path.join(subDir, "content");
        const clausesPath = path.join(contentDir, "clauses.json");

        if (fs.existsSync(clausesPath)) {
          try {
            const content = fs.readFileSync(clausesPath, "utf-8");
            const data = JSON.parse(content);
            const validation = validateClausesFile(data);

            if (validation.valid) {
              const boilerplatePath = path.join(contentDir, "boilerplate.json");
              let boilerplate: Boilerplate | null = null;

              if (fs.existsSync(boilerplatePath)) {
                try {
                  const bpContent = fs.readFileSync(boilerplatePath, "utf-8");
                  const bpData = JSON.parse(bpContent);
                  const bpParsed = BoilerplateSchema.safeParse(bpData);
                  if (bpParsed.success) {
                    boilerplate = bpParsed.data;
                  }
                } catch (e) {
                  console.warn(`Failed to load boilerplate from ${boilerplatePath}:`, e);
                }
              }

              const normalized = normalizeClausesFile(data, DEFAULT_LANGUAGE);
              skills.set(normalized.contractType, {
                clauses: data as ClausesFile,
                boilerplate,
              });
              console.log(`Loaded installed skill: ${normalized.displayName}`);
            }
          } catch (e) {
            console.warn(`Failed to load skill from ${clausesPath}:`, e);
          }
        } else {
          // Recurse into subdirectory
          scanRecursive(subDir);
        }
      }
    }
  };

  scanRecursive(INSTALLED_SKILLS_DIR);
  return skills;
}

/**
 * Sync skills to database (supports both legacy and i18n formats)
 */
export async function syncSkillsToDatabase(
  prisma: PrismaClient,
  options: { language?: string } = {}
): Promise<{ results: SkillLoadResult[] }> {
  const language = options.language || DEFAULT_LANGUAGE;

  // Load from both directories
  const legacySkills = scanSkillsDirectory();
  const installedSkills = scanInstalledSkillsDirectory();

  // Merge (installed skills take precedence)
  const allSkills = new Map([...legacySkills, ...installedSkills]);

  const results: SkillLoadResult[] = [];

  for (const [contractType, skillData] of allSkills) {
    const { clauses: rawSkill, boilerplate } = skillData;

    // Normalize i18n content
    const skill = normalizeClausesFile(rawSkill, language);

    try {
      // Upsert the contract template
      const template = await prisma.contractTemplate.upsert({
        where: { contractType },
        create: {
          contractType,
          displayName: skill.displayName,
          description: skill.description,
          version: skill.version || "1.0",
          skillPath: path.join(SKILLS_DIR, contractType.toLowerCase()),
          boilerplate: boilerplate || undefined,
        },
        update: {
          displayName: skill.displayName,
          description: skill.description,
          version: skill.version || "1.0",
          boilerplate: boilerplate || undefined,
        },
      });

      // Delete existing clauses and options (will cascade)
      await prisma.clauseTemplate.deleteMany({
        where: { contractTemplateId: template.id },
      });

      // Create clauses and options
      for (const clause of skill.clauses) {
        await prisma.clauseTemplate.create({
          data: {
            contractTemplateId: template.id,
            clauseId: clause.id,
            title: clause.title,
            category: clause.category,
            order: clause.order,
            plainDescription: clause.plainDescription,
            legalContext: clause.legalContext,
            isRequired: clause.isRequired ?? true,
            options: {
              create: clause.options.map((opt) => ({
                optionId: opt.id,
                code: opt.code,
                label: opt.label,
                order: opt.order,
                plainDescription: opt.plainDescription,
                prosPartyA: opt.prosPartyA,
                consPartyA: opt.consPartyA,
                prosPartyB: opt.prosPartyB,
                consPartyB: opt.consPartyB,
                legalText: opt.legalText,
                biasPartyA: opt.biasPartyA,
                biasPartyB: opt.biasPartyB,
                jurisdictionConfig: opt.jurisdictionConfig
                  ? JSON.parse(JSON.stringify(opt.jurisdictionConfig))
                  : undefined,
              })),
            },
          },
        });
      }

      results.push({
        contractType,
        displayName: skill.displayName,
        clauseCount: skill.clauses.length,
        hasBoilerplate: boilerplate !== null,
        status: "loaded",
      });
    } catch (error) {
      results.push({
        contractType,
        displayName: skill.displayName,
        clauseCount: skill.clauses.length,
        hasBoilerplate: boilerplate !== null,
        status: "error",
        error: String(error),
      });
    }
  }

  return { results };
}

/**
 * Get raw i18n content for a skill (for multilingual rendering)
 */
export function getRawSkillContent(contractType: string): SkillData | null {
  // Try installed skills first
  const installedSkills = scanInstalledSkillsDirectory();
  if (installedSkills.has(contractType)) {
    return installedSkills.get(contractType)!;
  }

  // Fall back to legacy skills
  const legacySkills = scanSkillsDirectory();
  return legacySkills.get(contractType) || null;
}
