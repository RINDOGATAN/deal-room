import type { ExtendedPrismaClient } from "@/lib/prisma";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import {
  resolveLocalizedString,
  resolveLocalizedArray,
} from "./i18n";
import { createLogger } from "@/lib/logger";

const logger = createLogger("skills-loader");

// Skills directory paths
const BUILTIN_SKILLS_DIR = path.join(process.cwd(), "skills");
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

// Legacy clause schema
const LegacyClauseSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  order: z.number(),
  plainDescription: z.string(),
  legalContext: z.string().optional(),
  isRequired: z.boolean().optional().default(true),
  options: z.array(LegacyClauseOptionSchema).min(2),
});

// I18n clause schema
const I18nClauseSchema = z.object({
  id: z.string(),
  title: LocalizedStringSchema,
  category: LocalizedStringSchema,
  order: z.number(),
  plainDescription: LocalizedStringSchema,
  legalContext: LocalizedStringSchema.optional(),
  isRequired: z.boolean().optional().default(true),
  options: z.array(I18nClauseOptionSchema).min(2),
});

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
  displayName: z.union([z.string(), z.record(z.string(), z.string())]),
  description: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
  version: z.string().optional().default("1.0"),
  clauseCount: z.number().optional(),
  jurisdictions: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  soloModeSupported: z.boolean().optional(),
  soloModeDefault: z.boolean().optional(),
  soloModeOnly: z.boolean().optional(),
  templateFamily: z.string().optional(),
  category: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
});

// Boilerplate schema for standard contract sections (supports both plain strings and i18n objects)
const BoilerplateStringSchema = z.union([z.string(), z.record(z.string(), z.string())]);

const DefinitionSchema = z.object({
  term: BoilerplateStringSchema,
  definition: BoilerplateStringSchema,
});

const StandardClauseSchema = z.object({
  title: BoilerplateStringSchema,
  text: BoilerplateStringSchema,
});

const JurisdictionProvisionSchema = z.object({
  title: BoilerplateStringSchema,
  text: BoilerplateStringSchema,
});

const PartyLabelsSchema = z.object({
  partyA: BoilerplateStringSchema,
  partyB: BoilerplateStringSchema,
}).optional();

const BoilerplateSchema = z.object({
  contractTitle: BoilerplateStringSchema,
  preamble: BoilerplateStringSchema,
  background: BoilerplateStringSchema.optional(),
  definitions: z.array(DefinitionSchema),
  standardClauses: z.array(StandardClauseSchema),
  generalProvisions: z.array(StandardClauseSchema),
  jurisdictionProvisions: z.record(z.string(), JurisdictionProvisionSchema),
  signatureBlock: BoilerplateStringSchema,
  partyLabels: PartyLabelsSchema,
  // Annexes/Schedules rendered on their own pages AFTER the signature blocks
  // (e.g. DPA Annex I — Description of Processing, Annex II — TOMs).
  annexes: z.array(StandardClauseSchema).optional(),
});

export type ClausesFile = z.infer<typeof ClausesFileSchema>;
export type SkillMetadata = z.infer<typeof MetadataSchema>;
export type Boilerplate = z.infer<typeof BoilerplateSchema>;

// Manifest schema (includes template family fields)
const ManifestSchema = z.object({
  skillId: z.string(),
  name: z.string(),
  displayName: z.string(),
  version: z.string(),
  jurisdictions: z.array(z.string()),
  languages: z.array(z.string()),
  author: z.string().optional(),
  license: z.string().optional(),
  templateFamily: z.string().optional(),
  nativeJurisdiction: z.string().optional(),
});

export type SkillManifest = z.infer<typeof ManifestSchema>;

// Clause mappings schema
const ClauseMappingEntrySchema = z.object({
  source: z.string().nullable(),
  target: z.string(),
  type: z.enum(["equivalent", "split", "merged", "new"]),
  notes: z.string().optional(),
});

const ClauseMappingsFileSchema = z.object({
  family: z.string(),
  sourceTemplate: z.string(),
  targetTemplate: z.string(),
  mappings: z.array(ClauseMappingEntrySchema),
});

export type ClauseMappingsFile = z.infer<typeof ClauseMappingsFileSchema>;

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
    category: resolveLocalizedString(c.category, language),
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

// ============================================================
// I18N CONTENT PRESERVATION HELPERS
// ============================================================

function isLocalized(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildClauseLocalizedContent(clause: Record<string, unknown>): Record<string, unknown> | undefined {
  const content: Record<string, unknown> = {};
  let hasLocalized = false;

  if (isLocalized(clause.title)) { content.title = clause.title; hasLocalized = true; }
  if (isLocalized(clause.category)) { content.category = clause.category; hasLocalized = true; }
  if (isLocalized(clause.plainDescription)) { content.plainDescription = clause.plainDescription; hasLocalized = true; }
  if (clause.legalContext && isLocalized(clause.legalContext)) { content.legalContext = clause.legalContext; hasLocalized = true; }

  return hasLocalized ? content : undefined;
}

function buildOptionLocalizedContent(option: Record<string, unknown>): Record<string, unknown> | undefined {
  const content: Record<string, unknown> = {};
  let hasLocalized = false;

  // Handle both legacy (prosPartyA) and i18n (pros.partyA) formats
  if (isLocalized(option.label)) { content.label = option.label; hasLocalized = true; }
  if (isLocalized(option.plainDescription)) { content.plainDescription = option.plainDescription; hasLocalized = true; }
  if (isLocalized(option.legalText)) { content.legalText = option.legalText; hasLocalized = true; }

  // Legacy format fields
  if (isLocalized(option.prosPartyA)) { content.prosPartyA = option.prosPartyA; hasLocalized = true; }
  if (isLocalized(option.consPartyA)) { content.consPartyA = option.consPartyA; hasLocalized = true; }
  if (isLocalized(option.prosPartyB)) { content.prosPartyB = option.prosPartyB; hasLocalized = true; }
  if (isLocalized(option.consPartyB)) { content.consPartyB = option.consPartyB; hasLocalized = true; }

  // New i18n format (pros/cons objects)
  const pros = option.pros as Record<string, unknown> | undefined;
  const cons = option.cons as Record<string, unknown> | undefined;
  if (pros?.partyA && isLocalized(pros.partyA)) { content.prosPartyA = pros.partyA; hasLocalized = true; }
  if (pros?.partyB && isLocalized(pros.partyB)) { content.prosPartyB = pros.partyB; hasLocalized = true; }
  if (cons?.partyA && isLocalized(cons.partyA)) { content.consPartyA = cons.partyA; hasLocalized = true; }
  if (cons?.partyB && isLocalized(cons.partyB)) { content.consPartyB = cons.partyB; hasLocalized = true; }

  return hasLocalized ? content : undefined;
}

function inferJurisdictionsFromClauses(rawData: unknown): string[] {
  const data = rawData as Record<string, unknown>;
  const clauses = (data.clauses as Array<Record<string, unknown>>) || [];
  const jurisdictions = new Set<string>();
  for (const clause of clauses) {
    const options = (clause.options as Array<Record<string, unknown>>) || [];
    for (const option of options) {
      const jc = option.jurisdictionConfig as Record<string, unknown> | undefined;
      if (jc) {
        for (const key of Object.keys(jc)) {
          jurisdictions.add(key);
        }
      }
    }
  }
  return jurisdictions.size > 0 ? Array.from(jurisdictions) : [];
}

function inferLanguagesFromClauses(rawData: unknown): string[] {
  const data = rawData as Record<string, unknown>;
  const clauses = (data.clauses as Array<Record<string, unknown>>) || [];
  for (const clause of clauses) {
    const options = (clause.options as Array<Record<string, unknown>>) || [];
    for (const option of options) {
      if (isLocalized(option.label)) {
        return Object.keys(option.label as Record<string, string>);
      }
    }
  }
  return ["en"];
}

interface SkillData {
  clauses: ClausesFile;
  boilerplate: Boilerplate | null;
  manifest: SkillManifest | null;
  clauseMappings: ClauseMappingsFile | null;
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
      if (options.length < 2) {
        errors.push(`Clause "${clauseTitle}" has fewer than 2 options`);
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
    logger.debug("No boilerplate.json found", { skillDir });
    return null;
  }

  try {
    const content = fs.readFileSync(boilerplatePath, "utf-8");
    const data = JSON.parse(content);
    const parsed = BoilerplateSchema.safeParse(data);

    if (!parsed.success) {
      logger.error("Boilerplate validation errors", { boilerplatePath });
      parsed.error.issues.forEach((err) =>
        logger.error("Boilerplate validation issue", {
          boilerplatePath,
          path: err.path.join("."),
          message: err.message,
        })
      );
      return null;
    }

    logger.debug("Loaded boilerplate", { skillDir });
    return parsed.data;
  } catch (e) {
    logger.error("Error loading boilerplate", { boilerplatePath, err: String(e) });
    return null;
  }
}

/**
 * Load manifest from a skill directory
 */
export function loadManifestFromDirectory(
  skillDir: string
): SkillManifest | null {
  const manifestPath = path.join(skillDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(manifestPath, "utf-8");
    const data = JSON.parse(content);
    const parsed = ManifestSchema.safeParse(data);

    if (!parsed.success) {
      logger.warn("Manifest validation errors", { manifestPath, issues: parsed.error.issues });
      return null;
    }

    return parsed.data;
  } catch (e) {
    logger.warn("Error loading manifest", { manifestPath, err: String(e) });
    return null;
  }
}

/**
 * Load clause mappings from a skill directory
 */
export function loadClauseMappingsFromDirectory(
  skillDir: string
): ClauseMappingsFile | null {
  const mappingsPath = path.join(skillDir, "clause-mappings.json");

  if (!fs.existsSync(mappingsPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(mappingsPath, "utf-8");
    const data = JSON.parse(content);
    const parsed = ClauseMappingsFileSchema.safeParse(data);

    if (!parsed.success) {
      logger.warn("Clause mappings validation errors", { mappingsPath, issues: parsed.error.issues });
      return null;
    }

    return parsed.data;
  } catch (e) {
    logger.warn("Error loading clause mappings", { mappingsPath, err: String(e) });
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
    logger.debug("No clauses.json found", { skillDir });
    return null;
  }

  try {
    const content = fs.readFileSync(clausesPath, "utf-8");
    const data = JSON.parse(content);
    const validation = validateClausesFile(data);

    if (!validation.valid) {
      logger.error("Validation errors", { clausesPath });
      validation.errors.forEach((err) => logger.error("Validation error", { clausesPath, error: err }));
      return null;
    }

    if (validation.warnings.length > 0) {
      logger.warn("Validation warnings", { clausesPath });
      validation.warnings.forEach((warn) => logger.warn("Validation warning", { clausesPath, warning: warn }));
    }

    // Also load boilerplate if available
    const boilerplate = loadBoilerplateFromDirectory(skillDir);

    // Load manifest and clause mappings
    const manifest = loadManifestFromDirectory(skillDir);
    const clauseMappings = loadClauseMappingsFromDirectory(skillDir);

    return {
      clauses: data as ClausesFile,
      boilerplate,
      manifest,
      clauseMappings,
    };
  } catch (e) {
    logger.error("Error loading clauses", { clausesPath, err: String(e) });
    return null;
  }
}

/**
 * Scan a single directory for skills
 */
function scanDirectory(dir: string, skills: Map<string, SkillData>): void {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillDir = path.join(dir, entry.name);
      const skillData = loadSkillFromDirectory(skillDir);
      if (skillData) {
        skills.set(skillData.clauses.contractType, skillData);
        logger.debug("Loaded skill", {
          displayName: skillData.clauses.displayName,
          clauseCount: skillData.clauses.clauses.length,
          boilerplate: skillData.boilerplate ? "yes" : "no",
          family: skillData.manifest?.templateFamily,
        });
      }
    }
  }
}

/**
 * Scan skills directories and load all skills (built-in first, then data/skills)
 */
export function scanSkillsDirectory(): Map<string, SkillData> {
  const skills = new Map<string, SkillData>();

  // Built-in skills (repo root /skills/) — loaded first
  scanDirectory(BUILTIN_SKILLS_DIR, skills);

  // Legacy data/skills directory — can override built-in
  scanDirectory(SKILLS_DIR, skills);

  if (skills.size === 0) {
    logger.warn("No skills found", { builtinDir: BUILTIN_SKILLS_DIR, skillsDir: SKILLS_DIR });
  }

  return skills;
}

/**
 * Scan installed skill packages directory
 */
export function scanInstalledSkillsDirectory(): Map<string, SkillData> {
  const skills = new Map<string, SkillData>();

  if (!fs.existsSync(INSTALLED_SKILLS_DIR)) {
    logger.debug("Installed skills directory not found", { dir: INSTALLED_SKILLS_DIR });
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
                  logger.warn("Failed to load boilerplate", { boilerplatePath, err: String(e) });
                }
              }

              const normalized = normalizeClausesFile(data, DEFAULT_LANGUAGE);
              const manifest = loadManifestFromDirectory(subDir) || loadManifestFromDirectory(contentDir);
              const clauseMappings = loadClauseMappingsFromDirectory(subDir) || loadClauseMappingsFromDirectory(contentDir);
              skills.set(normalized.contractType, {
                clauses: data as ClausesFile,
                boilerplate,
                manifest,
                clauseMappings,
              });
              logger.debug("Loaded installed skill", { displayName: normalized.displayName });
            }
          } catch (e) {
            logger.warn("Failed to load skill", { clausesPath, err: String(e) });
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
  prisma: ExtendedPrismaClient,
  options: { language?: string } = {}
): Promise<{ results: SkillLoadResult[] }> {
  const language = options.language || DEFAULT_LANGUAGE;

  // Load from both directories
  const legacySkills = scanSkillsDirectory();
  const installedSkills = scanInstalledSkillsDirectory();

  // Merge (installed skills take precedence)
  const allSkills = new Map([...legacySkills, ...installedSkills]);

  const results: SkillLoadResult[] = [];

  // Collect clause mappings for second pass (need all templates created first)
  const pendingMappings: Array<{ data: SkillData; contractType: string }> = [];

  for (const [contractType, skillData] of allSkills) {
    const { clauses: rawSkill, boilerplate, manifest } = skillData;
    const rawData = rawSkill as unknown as Record<string, unknown>;
    const rawClauses = (rawData.clauses as Array<Record<string, unknown>>) || [];

    // Normalize i18n content
    const skill = normalizeClausesFile(rawSkill, language);

    // Load metadata for built-in skills (jurisdictions/languages)
    let metadata: z.infer<typeof MetadataSchema> | null = null;
    // Try to find metadata.json in known skill directories
    for (const dir of [BUILTIN_SKILLS_DIR, SKILLS_DIR]) {
      const metaPath = path.join(dir, contractType.toLowerCase(), "metadata.json");
      if (fs.existsSync(metaPath)) {
        try {
          const parsed = MetadataSchema.safeParse(JSON.parse(fs.readFileSync(metaPath, "utf-8")));
          if (parsed.success) metadata = parsed.data;
        } catch { /* ignore */ }
        break;
      }
    }

    // Resolve jurisdictions and languages
    const jurisdictions =
      metadata?.jurisdictions || manifest?.jurisdictions || inferJurisdictionsFromClauses(rawSkill);
    const languages =
      metadata?.languages || manifest?.languages || inferLanguagesFromClauses(rawSkill);

    // Build localized display name/description
    const displayNameLocalized = isLocalized(rawData.displayName)
      ? rawData.displayName
      : metadata?.displayName && isLocalized(metadata.displayName)
        ? metadata.displayName
        : undefined;
    const descriptionLocalized = metadata?.description && isLocalized(metadata.description)
      ? metadata.description
      : rawData.description && isLocalized(rawData.description)
        ? rawData.description
        : undefined;

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
          templateFamily: manifest?.templateFamily || metadata?.templateFamily || null,
          nativeJurisdiction: (manifest?.nativeJurisdiction as any) || null,
          jurisdictions,
          languages,
          displayNameLocalized: (displayNameLocalized as any) || undefined,
          descriptionLocalized: (descriptionLocalized as any) || undefined,
          soloModeSupported: metadata?.soloModeSupported ?? false,
          soloModeDefault: metadata?.soloModeDefault ?? false,
          soloModeOnly: metadata?.soloModeOnly ?? false,
        },
        update: {
          displayName: skill.displayName,
          description: skill.description,
          version: skill.version || "1.0",
          boilerplate: boilerplate || undefined,
          templateFamily: manifest?.templateFamily || metadata?.templateFamily || null,
          nativeJurisdiction: (manifest?.nativeJurisdiction as any) || null,
          jurisdictions,
          languages,
          displayNameLocalized: (displayNameLocalized as any) || undefined,
          descriptionLocalized: (descriptionLocalized as any) || undefined,
          soloModeSupported: metadata?.soloModeSupported ?? false,
          soloModeDefault: metadata?.soloModeDefault ?? false,
          soloModeOnly: metadata?.soloModeOnly ?? false,
        },
      });

      // Delete existing clauses and options (will cascade)
      await prisma.clauseTemplate.deleteMany({
        where: { contractTemplateId: template.id },
      });

      // Create clauses and options
      for (let i = 0; i < skill.clauses.length; i++) {
        const clause = skill.clauses[i];
        const rawClause = rawClauses[i] || {};
        const clauseLocalized = buildClauseLocalizedContent(rawClause);

        const rawOptions = (rawClause.options as Array<Record<string, unknown>>) || [];

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
            localizedContent: (clauseLocalized as any) || undefined,
            options: {
              create: clause.options.map((opt, j) => {
                const rawOpt = rawOptions[j] || {};
                const optLocalized = buildOptionLocalizedContent(rawOpt);
                return {
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
                  localizedContent: (optLocalized as any) || undefined,
                };
              }),
            },
          },
        });
      }

      // Track for clause mappings second pass
      if (skillData.clauseMappings) {
        pendingMappings.push({ data: skillData, contractType });
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

  // Second pass: sync clause mappings (all templates now exist)
  for (const { data: skillData } of pendingMappings) {
    const mappings = skillData.clauseMappings!;
    try {
      const sourceTemplate = await prisma.contractTemplate.findUnique({
        where: { contractType: mappings.sourceTemplate },
      });
      const targetTemplate = await prisma.contractTemplate.findUnique({
        where: { contractType: mappings.targetTemplate },
      });

      if (sourceTemplate && targetTemplate) {
        for (const mapping of mappings.mappings) {
          const sourceClauseId = mapping.source || mapping.target;
          await prisma.clauseMapping.upsert({
            where: {
              familyKey_sourceClauseId_targetClauseId: {
                familyKey: mappings.family,
                sourceClauseId,
                targetClauseId: mapping.target,
              },
            },
            create: {
              familyKey: mappings.family,
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
        logger.debug("Synced clause mappings", {
          count: mappings.mappings.length,
          family: mappings.family,
        });
      }
    } catch (error) {
      logger.error("Failed to sync clause mappings", {
        family: mappings.family,
        err: String(error),
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
