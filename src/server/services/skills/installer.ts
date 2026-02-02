/**
 * Skill Package Installer
 *
 * Handles:
 * - Extracting .skill packages (ZIP archives)
 * - Validating package contents
 * - Installing skills to database
 * - Version management and upgrades
 */

import { createReadStream, promises as fs } from "fs";
import { join, basename } from "path";
import { createHash } from "crypto";
import { Readable } from "stream";
import { SkillPackageValidator, ValidationResult } from "./validator";
import { computePackageHash, PackageManifest } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { resolveLocalizedString, resolveLocalizedArray } from "./i18n";

// We'll use a streaming unzip approach
// In production, use a library like 'unzipper' or 'adm-zip'
// For now, we'll implement a simple version using built-in modules

interface ExtractedPackage {
  files: Map<string, Buffer>;
  signature: Buffer | null;
}

interface InstallResult {
  success: boolean;
  skillPackageId?: string;
  contractTemplateId?: string;
  errors: string[];
  warnings?: string[];
}

interface SkillContent {
  clauses: {
    id: string;
    title: string;
    category: string;
    order: number;
    plainDescription: string;
    isRequired: boolean;
    legalContext?: string;
    options: Array<{
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
    }>;
  }[];
  boilerplate?: Record<string, unknown>;
}

export class SkillPackageInstaller {
  private validator: SkillPackageValidator;
  private skillsDir: string;
  private defaultLanguage: string;

  constructor(options?: { skillsDir?: string; defaultLanguage?: string }) {
    this.validator = new SkillPackageValidator();
    this.skillsDir = options?.skillsDir || process.env.INSTALLED_SKILLS_DIR || "./data/skills";
    this.defaultLanguage = options?.defaultLanguage || "en";
  }

  /**
   * Install a skill package from a file path.
   */
  async installFromFile(filePath: string): Promise<InstallResult> {
    try {
      // Extract the package
      const extracted = await this.extractPackage(filePath);

      // Validate the package
      const validation = await this.validator.validatePackage(
        extracted.files,
        extracted.signature || Buffer.alloc(0)
      );

      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors.map((e) => `${e.code}: ${e.message}`),
          warnings: validation.warnings,
        };
      }

      // Install to database
      return await this.installToDatabase(extracted.files, validation.manifest!);
    } catch (error) {
      return {
        success: false,
        errors: [
          `Installation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      };
    }
  }

  /**
   * Install a skill package from a Buffer (in-memory).
   */
  async installFromBuffer(buffer: Buffer): Promise<InstallResult> {
    try {
      const extracted = await this.extractPackageFromBuffer(buffer);

      const validation = await this.validator.validatePackage(
        extracted.files,
        extracted.signature || Buffer.alloc(0)
      );

      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors.map((e) => `${e.code}: ${e.message}`),
          warnings: validation.warnings,
        };
      }

      return await this.installToDatabase(extracted.files, validation.manifest!);
    } catch (error) {
      return {
        success: false,
        errors: [
          `Installation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      };
    }
  }

  /**
   * Extract a .skill package (ZIP format) from file path.
   */
  private async extractPackage(filePath: string): Promise<ExtractedPackage> {
    const content = await fs.readFile(filePath);
    return this.extractPackageFromBuffer(content);
  }

  /**
   * Extract a .skill package from buffer.
   * Uses a simple ZIP extraction - in production, use 'adm-zip' or 'unzipper'
   */
  private async extractPackageFromBuffer(buffer: Buffer): Promise<ExtractedPackage> {
    // For now, we'll implement a simple extraction
    // In production, use a proper ZIP library
    const files = new Map<string, Buffer>();
    let signature: Buffer | null = null;

    // Check for ZIP signature (PK\x03\x04)
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
      // This is a ZIP file - use adm-zip or similar in production
      // For now, throw an error prompting to use the library
      throw new Error(
        "ZIP extraction requires 'adm-zip' package. Install it and update this method."
      );
    }

    // Assume it's a directory-based install for development
    // In production, this would handle the actual ZIP extraction
    throw new Error("Direct buffer extraction not implemented. Use installFromDirectory.");
  }

  /**
   * Install from an extracted directory (development mode).
   */
  async installFromDirectory(dirPath: string): Promise<InstallResult> {
    try {
      const files = await this.readDirectoryRecursive(dirPath);

      // For development, we skip signature verification
      // Just validate the content
      const manifestContent = files.get("manifest.json");
      if (!manifestContent) {
        return {
          success: false,
          errors: ["No manifest.json found in directory"],
        };
      }

      const manifest = JSON.parse(manifestContent.toString("utf-8")) as PackageManifest;

      // Validate content files
      const clausesContent = files.get("content/clauses.json");
      if (!clausesContent) {
        return {
          success: false,
          errors: ["No content/clauses.json found"],
        };
      }

      const validation = this.validator.validateContentOnly(clausesContent.toString("utf-8"));
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors.map((e) => `${e.code}: ${e.message}`),
        };
      }

      return await this.installToDatabase(files, manifest);
    } catch (error) {
      return {
        success: false,
        errors: [
          `Installation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      };
    }
  }

  /**
   * Read all files from a directory recursively.
   */
  private async readDirectoryRecursive(
    dirPath: string,
    basePath: string = ""
  ): Promise<Map<string, Buffer>> {
    const files = new Map<string, Buffer>();
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const subFiles = await this.readDirectoryRecursive(fullPath, relativePath);
        for (const [path, content] of subFiles) {
          files.set(path, content);
        }
      } else if (entry.isFile()) {
        const content = await fs.readFile(fullPath);
        files.set(relativePath, content);
      }
    }

    return files;
  }

  /**
   * Install skill content to database.
   */
  private async installToDatabase(
    files: Map<string, Buffer>,
    manifest: PackageManifest
  ): Promise<InstallResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse content files
      const clausesJson = files.get("content/clauses.json");
      const boilerplateJson = files.get("content/boilerplate.json");

      if (!clausesJson) {
        return { success: false, errors: ["Missing content/clauses.json"] };
      }

      const clauses = JSON.parse(clausesJson.toString("utf-8"));
      const boilerplate = boilerplateJson
        ? JSON.parse(boilerplateJson.toString("utf-8"))
        : null;

      // Resolve i18n content to default language
      const resolvedContent = this.resolveContent(clauses, boilerplate);

      // Compute package hash
      const packageHash = computePackageHash(files);

      // Create/update in transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Upsert SkillPackage
        const skillPackage = await tx.skillPackage.upsert({
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
            updatedAt: new Date(),
          },
        });

        // 2. Upsert ContractTemplate
        const contractTemplate = await tx.contractTemplate.upsert({
          where: { contractType: manifest.name },
          create: {
            contractType: manifest.name,
            displayName: resolveLocalizedString(clauses.displayName, this.defaultLanguage),
            description: clauses.description
              ? resolveLocalizedString(clauses.description, this.defaultLanguage)
              : null,
            version: manifest.version,
            skillPath: `installed/${manifest.skillId}`,
            boilerplate: boilerplate || undefined,
            isActive: true,
            skillPackageId: skillPackage.id,
          },
          update: {
            displayName: resolveLocalizedString(clauses.displayName, this.defaultLanguage),
            description: clauses.description
              ? resolveLocalizedString(clauses.description, this.defaultLanguage)
              : null,
            version: manifest.version,
            boilerplate: boilerplate || undefined,
            skillPackageId: skillPackage.id,
            updatedAt: new Date(),
          },
        });

        // 3. Delete existing clauses for this template
        await tx.clauseTemplate.deleteMany({
          where: { contractTemplateId: contractTemplate.id },
        });

        // 4. Create clause templates and options
        for (const clause of resolvedContent.clauses) {
          const clauseTemplate = await tx.clauseTemplate.create({
            data: {
              contractTemplateId: contractTemplate.id,
              clauseId: clause.id,
              title: clause.title,
              category: clause.category,
              order: clause.order,
              plainDescription: clause.plainDescription,
              legalContext: clause.legalContext,
              isRequired: clause.isRequired,
            },
          });

          // Create options
          for (const option of clause.options) {
            await tx.clauseOption.create({
              data: {
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
                jurisdictionConfig: option.jurisdictionConfig
                  ? JSON.parse(JSON.stringify(option.jurisdictionConfig))
                  : undefined,
              },
            });
          }
        }

        return { skillPackage, contractTemplate };
      });

      // Save raw files to disk for reference
      await this.savePackageFiles(manifest.skillId, files);

      return {
        success: true,
        skillPackageId: result.skillPackage.id,
        contractTemplateId: result.contractTemplate.id,
        errors: [],
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          `Database installation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      };
    }
  }

  /**
   * Resolve i18n content to a specific language.
   */
  private resolveContent(
    clauses: Record<string, unknown>,
    boilerplate: Record<string, unknown> | null
  ): SkillContent {
    const lang = this.defaultLanguage;
    const clausesArray = (clauses.clauses as Array<Record<string, unknown>>) || [];

    return {
      clauses: clausesArray.map((clause) => ({
        id: clause.id as string,
        title: resolveLocalizedString(clause.title, lang),
        category: clause.category as string,
        order: clause.order as number,
        plainDescription: resolveLocalizedString(clause.plainDescription, lang),
        isRequired: (clause.isRequired as boolean) ?? true,
        legalContext: clause.legalContext
          ? resolveLocalizedString(clause.legalContext, lang)
          : undefined,
        options: ((clause.options as Array<Record<string, unknown>>) || []).map(
          (option) => ({
            id: option.id as string,
            code: option.code as string,
            label: resolveLocalizedString(option.label, lang),
            order: option.order as number,
            plainDescription: resolveLocalizedString(option.plainDescription, lang),
            prosPartyA: resolveLocalizedArray(
              (option.pros as Record<string, unknown>)?.partyA,
              lang
            ),
            consPartyA: resolveLocalizedArray(
              (option.cons as Record<string, unknown>)?.partyA,
              lang
            ),
            prosPartyB: resolveLocalizedArray(
              (option.pros as Record<string, unknown>)?.partyB,
              lang
            ),
            consPartyB: resolveLocalizedArray(
              (option.cons as Record<string, unknown>)?.partyB,
              lang
            ),
            legalText: resolveLocalizedString(option.legalText, lang),
            biasPartyA: (option.bias as Record<string, number>)?.partyA ?? 0,
            biasPartyB: (option.bias as Record<string, number>)?.partyB ?? 0,
            jurisdictionConfig: option.jurisdictionConfig as
              | Record<string, unknown>
              | undefined,
          })
        ),
      })),
      boilerplate: boilerplate || undefined,
    };
  }

  /**
   * Save package files to disk for reference.
   */
  private async savePackageFiles(
    skillId: string,
    files: Map<string, Buffer>
  ): Promise<void> {
    const targetDir = join(this.skillsDir, "installed", skillId.replace(/\./g, "/"));

    await fs.mkdir(targetDir, { recursive: true });

    for (const [path, content] of files) {
      const filePath = join(targetDir, path);
      const fileDir = join(filePath, "..");
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, content);
    }
  }

  /**
   * Uninstall a skill package.
   */
  async uninstall(skillId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.$transaction(async (tx) => {
        // Find the skill package
        const skillPackage = await tx.skillPackage.findUnique({
          where: { skillId },
          include: { contractTemplate: true },
        });

        if (!skillPackage) {
          throw new Error(`Skill package not found: ${skillId}`);
        }

        // Check for active deals using this template
        if (skillPackage.contractTemplate) {
          const activeDealCount = await tx.dealRoom.count({
            where: {
              contractTemplateId: skillPackage.contractTemplate.id,
              status: { notIn: ["COMPLETED", "CANCELLED"] },
            },
          });

          if (activeDealCount > 0) {
            throw new Error(
              `Cannot uninstall: ${activeDealCount} active deals use this skill`
            );
          }
        }

        // Delete in order (cascade should handle most)
        if (skillPackage.contractTemplate) {
          await tx.contractTemplate.delete({
            where: { id: skillPackage.contractTemplate.id },
          });
        }

        await tx.skillPackage.delete({
          where: { id: skillPackage.id },
        });
      });

      // Remove files from disk
      const targetDir = join(this.skillsDir, "installed", skillId.replace(/\./g, "/"));
      try {
        await fs.rm(targetDir, { recursive: true });
      } catch {
        // Ignore file deletion errors
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * List installed skill packages.
   */
  async listInstalled() {
    return prisma.skillPackage.findMany({
      where: { isActive: true },
      include: {
        contractTemplate: {
          select: { id: true, contractType: true, displayName: true },
        },
        _count: { select: { entitlements: true } },
      },
      orderBy: { installedAt: "desc" },
    });
  }

  /**
   * Get skill package details.
   */
  async getPackageDetails(skillId: string) {
    return prisma.skillPackage.findUnique({
      where: { skillId },
      include: {
        contractTemplate: {
          include: {
            clauses: {
              include: { options: true },
              orderBy: { order: "asc" },
            },
          },
        },
        entitlements: {
          select: {
            id: true,
            customerId: true,
            licenseType: true,
            status: true,
            jurisdictions: true,
          },
        },
      },
    });
  }
}

export const defaultInstaller = new SkillPackageInstaller();
