/**
 * Skill Package Validator
 *
 * Validates .skill packages:
 * - Ed25519 signature verification
 * - Manifest structure validation
 * - File integrity checking
 * - Content schema validation
 */

import { z } from "zod";
import {
  verifyEd25519Signature,
  sha256,
  computePackageHash,
  PackageManifest,
} from "@/lib/crypto";

// ============================================================
// MANIFEST SCHEMA
// ============================================================

export const ManifestSchema = z.object({
  skillId: z
    .string()
    .regex(
      /^com\.nel\.skills\.[a-z][a-z0-9-]*$/,
      "Skill ID must match pattern: com.nel.skills.<name>"
    ),
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be semver (e.g., 1.2.3)"),
  description: z.string().optional(),
  jurisdictions: z.array(z.string()).min(1),
  languages: z.array(z.string()).min(1).default(["en"]),
  files: z.record(z.string(), z.string()),
  createdAt: z.string().datetime(),
  author: z.string().optional(),
  license: z.string().optional(),
});

// ============================================================
// I18N-AWARE CLAUSE SCHEMAS
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

export const ClauseOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: LocalizedStringSchema,
  order: z.number().int().min(1),
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
  jurisdictionConfig: z
    .record(
      z.string(),
      z.object({
        available: z.boolean().default(true),
        warning: LocalizedStringSchema.optional(),
        alternativeText: LocalizedStringSchema.optional(),
      })
    )
    .optional(),
});

export const ClauseSchema = z
  .object({
    id: z.string(),
    title: LocalizedStringSchema,
    category: z.string(),
    order: z.number().int().min(1),
    plainDescription: LocalizedStringSchema,
    isRequired: z.boolean().default(true),
    legalContext: LocalizedStringSchema.optional(),
    options: z.array(ClauseOptionSchema).min(3),
  })
  .refine(
    (clause) => {
      const optionIds = clause.options.map((o) => o.id);
      return new Set(optionIds).size === optionIds.length;
    },
    { message: "Option IDs must be unique within a clause" }
  );

export const ClausesFileSchema = z.object({
  contractType: z.string(),
  displayName: LocalizedStringSchema,
  description: LocalizedStringSchema.optional(),
  clauses: z.array(ClauseSchema),
});

export const BoilerplateSchema = z.object({
  preamble: LocalizedStringSchema.optional(),
  definitions: z.record(z.string(), LocalizedStringSchema).optional(),
  standardSections: z
    .array(
      z.object({
        title: LocalizedStringSchema,
        content: LocalizedStringSchema,
        order: z.number().int(),
      })
    )
    .optional(),
  signatureBlock: LocalizedStringSchema.optional(),
  jurisdictionProvisions: z
    .record(
      z.string(),
      z.object({
        governingLaw: LocalizedStringSchema,
        disputeResolution: LocalizedStringSchema,
        notices: LocalizedStringSchema.optional(),
      })
    )
    .optional(),
});

// ============================================================
// VALIDATION RESULT TYPES
// ============================================================

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
  details?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  manifest?: PackageManifest;
  warnings?: string[];
}

// ============================================================
// VALIDATOR CLASS
// ============================================================

export class SkillPackageValidator {
  private publicKeyPem?: string;

  constructor(publicKeyPem?: string) {
    this.publicKeyPem = publicKeyPem;
  }

  /**
   * Validate a complete skill package.
   */
  async validatePackage(
    files: Map<string, Buffer>,
    signature: Buffer
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // 1. Check required files exist
    if (!files.has("manifest.json")) {
      errors.push({
        code: "MISSING_MANIFEST",
        message: "Package must contain manifest.json",
      });
      return { valid: false, errors };
    }

    if (!files.has("content/clauses.json")) {
      errors.push({
        code: "MISSING_CLAUSES",
        message: "Package must contain content/clauses.json",
      });
      return { valid: false, errors };
    }

    // 2. Parse and validate manifest
    let manifest: PackageManifest;
    try {
      const manifestContent = files.get("manifest.json")!.toString("utf-8");
      const parsed = JSON.parse(manifestContent);
      const result = ManifestSchema.safeParse(parsed);

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            code: "INVALID_MANIFEST",
            message: issue.message,
            path: issue.path.join("."),
          });
        }
        return { valid: false, errors };
      }

      manifest = result.data as PackageManifest;
    } catch (e) {
      errors.push({
        code: "MANIFEST_PARSE_ERROR",
        message: `Failed to parse manifest.json: ${e instanceof Error ? e.message : "Unknown error"}`,
      });
      return { valid: false, errors };
    }

    // 3. Verify file integrity (check hashes in manifest)
    const integrityErrors = this.verifyFileIntegrity(files, manifest);
    errors.push(...integrityErrors);

    if (integrityErrors.length > 0) {
      return { valid: false, errors, manifest };
    }

    // 4. Verify Ed25519 signature
    const signatureValid = this.verifySignature(files, signature);
    if (!signatureValid) {
      errors.push({
        code: "INVALID_SIGNATURE",
        message: "Package signature verification failed",
      });
      return { valid: false, errors, manifest };
    }

    // 5. Validate clauses.json content
    const clausesErrors = this.validateClausesFile(files.get("content/clauses.json")!);
    errors.push(...clausesErrors);

    // 6. Validate boilerplate.json if present
    if (files.has("content/boilerplate.json")) {
      const boilerplateErrors = this.validateBoilerplateFile(
        files.get("content/boilerplate.json")!
      );
      errors.push(...boilerplateErrors);
    }

    // 7. Check language coverage
    const languageWarnings = this.checkLanguageCoverage(
      files.get("content/clauses.json")!,
      manifest.languages
    );
    warnings.push(...languageWarnings);

    return {
      valid: errors.length === 0,
      errors,
      manifest,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Verify all files match their hashes in the manifest.
   */
  private verifyFileIntegrity(
    files: Map<string, Buffer>,
    manifest: PackageManifest
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check all manifest files exist and match hash
    for (const [path, expectedHash] of Object.entries(manifest.files)) {
      if (!files.has(path)) {
        errors.push({
          code: "MISSING_FILE",
          message: `File listed in manifest not found: ${path}`,
          path,
        });
        continue;
      }

      const actualHash = sha256(files.get(path)!);
      if (actualHash !== expectedHash) {
        errors.push({
          code: "HASH_MISMATCH",
          message: `File hash mismatch for ${path}`,
          path,
          details: { expected: expectedHash, actual: actualHash },
        });
      }
    }

    // Warn about extra files not in manifest (excluding signature)
    for (const path of files.keys()) {
      if (path !== "manifest.json" && path !== "signature.sig" && !manifest.files[path]) {
        errors.push({
          code: "EXTRA_FILE",
          message: `File not listed in manifest: ${path}`,
          path,
        });
      }
    }

    return errors;
  }

  /**
   * Verify Ed25519 signature of the package.
   */
  private verifySignature(files: Map<string, Buffer>, signature: Buffer): boolean {
    // Compute the package hash (deterministic)
    const dataToSign = this.computeSigningData(files);
    return verifyEd25519Signature(dataToSign, signature, this.publicKeyPem);
  }

  /**
   * Compute the canonical data to sign/verify.
   */
  private computeSigningData(files: Map<string, Buffer>): Buffer {
    // Hash all files except signature
    const filesToHash = new Map<string, Buffer>();
    for (const [path, content] of files) {
      if (path !== "signature.sig") {
        filesToHash.set(path, content);
      }
    }

    const hash = computePackageHash(filesToHash);
    return Buffer.from(hash, "hex");
  }

  /**
   * Validate clauses.json content structure.
   */
  private validateClausesFile(content: Buffer): ValidationError[] {
    const errors: ValidationError[] = [];

    try {
      const parsed = JSON.parse(content.toString("utf-8"));
      const result = ClausesFileSchema.safeParse(parsed);

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            code: "INVALID_CLAUSES",
            message: issue.message,
            path: `clauses.json:${issue.path.join(".")}`,
          });
        }
      }
    } catch (e) {
      errors.push({
        code: "CLAUSES_PARSE_ERROR",
        message: `Failed to parse clauses.json: ${e instanceof Error ? e.message : "Unknown error"}`,
      });
    }

    return errors;
  }

  /**
   * Validate boilerplate.json content structure.
   */
  private validateBoilerplateFile(content: Buffer): ValidationError[] {
    const errors: ValidationError[] = [];

    try {
      const parsed = JSON.parse(content.toString("utf-8"));
      const result = BoilerplateSchema.safeParse(parsed);

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            code: "INVALID_BOILERPLATE",
            message: issue.message,
            path: `boilerplate.json:${issue.path.join(".")}`,
          });
        }
      }
    } catch (e) {
      errors.push({
        code: "BOILERPLATE_PARSE_ERROR",
        message: `Failed to parse boilerplate.json: ${e instanceof Error ? e.message : "Unknown error"}`,
      });
    }

    return errors;
  }

  /**
   * Check that all declared languages have translations.
   */
  private checkLanguageCoverage(
    clausesContent: Buffer,
    declaredLanguages: string[]
  ): string[] {
    const warnings: string[] = [];

    if (declaredLanguages.length <= 1) {
      return warnings;
    }

    try {
      const parsed = JSON.parse(clausesContent.toString("utf-8"));

      // Check a sample of fields for language coverage
      const checkLocalized = (
        value: unknown,
        path: string,
        languages: string[]
      ) => {
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          const keys = Object.keys(value);
          const missingLangs = languages.filter((lang) => !keys.includes(lang));
          if (missingLangs.length > 0) {
            warnings.push(
              `Missing translations for ${missingLangs.join(", ")} at ${path}`
            );
          }
        }
      };

      // Check displayName
      checkLocalized(parsed.displayName, "displayName", declaredLanguages);

      // Check first clause title (sample)
      if (parsed.clauses?.[0]?.title) {
        checkLocalized(
          parsed.clauses[0].title,
          "clauses[0].title",
          declaredLanguages
        );
      }
    } catch {
      // Already handled in validation
    }

    return warnings;
  }

  /**
   * Quick validation without signature check (for development).
   */
  validateContentOnly(clausesJson: string): ValidationResult {
    const errors: ValidationError[] = [];

    try {
      const parsed = JSON.parse(clausesJson);
      const result = ClausesFileSchema.safeParse(parsed);

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            code: "INVALID_CLAUSES",
            message: issue.message,
            path: issue.path.join("."),
          });
        }
      }
    } catch (e) {
      errors.push({
        code: "PARSE_ERROR",
        message: `Failed to parse JSON: ${e instanceof Error ? e.message : "Unknown error"}`,
      });
    }

    return { valid: errors.length === 0, errors };
  }
}

export const defaultValidator = new SkillPackageValidator();
