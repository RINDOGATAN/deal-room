import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";

// Skills directory path - can be configured via env
const SKILLS_DIR = process.env.SKILLS_DIR || path.join(process.cwd(), "data/skills");

// Schema definitions for validation
const ClauseOptionSchema = z.object({
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
});

const ClauseSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  order: z.number(),
  plainDescription: z.string(),
  legalContext: z.string().optional(),
  isRequired: z.boolean().optional().default(true),
  options: z.array(ClauseOptionSchema).min(3),
});

const ClausesFileSchema = z.object({
  contractType: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  version: z.string().optional().default("1.0"),
  clauses: z.array(ClauseSchema),
});

const MetadataSchema = z.object({
  contractType: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  version: z.string().optional().default("1.0"),
  clauseCount: z.number().optional(),
});

export type ClausesFile = z.infer<typeof ClausesFileSchema>;
export type SkillMetadata = z.infer<typeof MetadataSchema>;

interface SkillLoadResult {
  contractType: string;
  displayName: string;
  clauseCount: number;
  status: "loaded" | "error";
  error?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a clauses.json file
 */
export function validateClausesFile(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const parsed = ClausesFileSchema.parse(data);

    // Additional validation
    for (const clause of parsed.clauses) {
      // Check option count
      if (clause.options.length < 3) {
        errors.push(`Clause "${clause.title}" has fewer than 3 options`);
      }

      // Check for unique option IDs
      const optionIds = new Set<string>();
      for (const option of clause.options) {
        if (optionIds.has(option.id)) {
          errors.push(
            `Clause "${clause.title}" has duplicate option ID: ${option.id}`
          );
        }
        optionIds.add(option.id);

        // Validate bias scores
        if (option.biasPartyA < -1 || option.biasPartyA > 1) {
          errors.push(
            `Option "${option.label}" in "${clause.title}" has invalid biasPartyA: ${option.biasPartyA}`
          );
        }
        if (option.biasPartyB < -1 || option.biasPartyB > 1) {
          errors.push(
            `Option "${option.label}" in "${clause.title}" has invalid biasPartyB: ${option.biasPartyB}`
          );
        }

        // Check for pros/cons
        if (option.prosPartyA.length === 0) {
          warnings.push(
            `Option "${option.label}" in "${clause.title}" has no prosPartyA`
          );
        }
        if (option.consPartyA.length === 0) {
          warnings.push(
            `Option "${option.label}" in "${clause.title}" has no consPartyA`
          );
        }
        if (option.prosPartyB.length === 0) {
          warnings.push(
            `Option "${option.label}" in "${clause.title}" has no prosPartyB`
          );
        }
        if (option.consPartyB.length === 0) {
          warnings.push(
            `Option "${option.label}" in "${clause.title}" has no consPartyB`
          );
        }
      }

      // Check for legalContext
      if (!clause.legalContext) {
        warnings.push(`Clause "${clause.title}" is missing legalContext`);
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
 * Load a skill from a directory
 */
export function loadSkillFromDirectory(
  skillDir: string
): ClausesFile | null {
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

    return data as ClausesFile;
  } catch (e) {
    console.error(`Error loading ${clausesPath}:`, e);
    return null;
  }
}

/**
 * Scan skills directory and load all skills
 */
export function scanSkillsDirectory(): Map<string, ClausesFile> {
  const skills = new Map<string, ClausesFile>();

  if (!fs.existsSync(SKILLS_DIR)) {
    console.warn(`Skills directory not found: ${SKILLS_DIR}`);
    return skills;
  }

  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillDir = path.join(SKILLS_DIR, entry.name);
      const skill = loadSkillFromDirectory(skillDir);
      if (skill) {
        skills.set(skill.contractType, skill);
        console.log(
          `Loaded skill: ${skill.displayName} (${skill.clauses.length} clauses)`
        );
      }
    }
  }

  return skills;
}

/**
 * Sync skills to database
 */
export async function syncSkillsToDatabase(
  prisma: PrismaClient
): Promise<{ results: SkillLoadResult[] }> {
  const skills = scanSkillsDirectory();
  const results: SkillLoadResult[] = [];

  for (const [contractType, skill] of skills) {
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
        },
        update: {
          displayName: skill.displayName,
          description: skill.description,
          version: skill.version || "1.0",
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
              })),
            },
          },
        });
      }

      results.push({
        contractType,
        displayName: skill.displayName,
        clauseCount: skill.clauses.length,
        status: "loaded",
      });
    } catch (error) {
      results.push({
        contractType,
        displayName: skill.displayName,
        clauseCount: skill.clauses.length,
        status: "error",
        error: String(error),
      });
    }
  }

  return { results };
}
