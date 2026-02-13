#!/usr/bin/env npx tsx
/**
 * CLI Command: skill:verify
 *
 * Verify a skill package's signature and integrity.
 *
 * Usage:
 *   npx deal-room skill:verify ./nda.skill
 *   npx deal-room skill:verify ./skills/nda/  --skip-signature
 */

import AdmZip from "adm-zip";
import { SkillPackageValidator } from "../../src/server/services/skills/validator";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const args = process.argv.slice(2);
  const skipSignature = args.includes("--skip-signature");
  const filteredArgs = args.filter((a) => !a.startsWith("--"));

  if (
    filteredArgs.length === 0 ||
    args.includes("--help") ||
    args.includes("-h")
  ) {
    console.log(`
Usage: npx deal-room skill:verify <path> [options]

Verify a skill package's signature and content integrity.

Arguments:
  path    Path to .skill package file or skill directory

Options:
  --skip-signature    Skip signature verification (for development)
  --help, -h          Show this help message

Examples:
  npx deal-room skill:verify ./nda.skill
  npx deal-room skill:verify ./skills/nda/ --skip-signature
`);
    process.exit(0);
  }

  const packagePath = path.resolve(filteredArgs[0]);

  if (!fs.existsSync(packagePath)) {
    console.error(`Error: Path not found: ${packagePath}`);
    process.exit(1);
  }

  const validator = new SkillPackageValidator();
  const stats = fs.statSync(packagePath);

  console.log(`Verifying skill package: ${packagePath}`);
  console.log("");

  if (stats.isDirectory()) {
    // Validate directory contents
    const clausesPath = path.join(packagePath, "clauses.json");
    const contentClausesPath = path.join(packagePath, "content", "clauses.json");

    let clausesFile: string;
    if (fs.existsSync(clausesPath)) {
      clausesFile = clausesPath;
    } else if (fs.existsSync(contentClausesPath)) {
      clausesFile = contentClausesPath;
    } else {
      console.error("Error: No clauses.json found in directory");
      process.exit(1);
    }

    const content = fs.readFileSync(clausesFile, "utf-8");
    const result = validator.validateContentOnly(content);

    if (result.valid) {
      console.log("✓ Content validation passed");
    } else {
      console.log("✗ Content validation failed");
      console.log("\nErrors:");
      for (const error of result.errors) {
        console.log(`  - ${error.code}: ${error.message}`);
        if (error.path) {
          console.log(`    Path: ${error.path}`);
        }
      }
      process.exit(1);
    }

    if (skipSignature) {
      console.log("⊘ Signature verification skipped (--skip-signature)");
    } else {
      console.log("⚠ Signature verification requires .skill package file");
    }
  } else {
    // Full .skill package verification
    const buffer = fs.readFileSync(packagePath);
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    const files = new Map<string, Buffer>();
    let signature: Buffer | null = null;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (entry.entryName === "signature.sig") {
        signature = entry.getData();
      } else {
        files.set(entry.entryName, entry.getData());
      }
    }

    console.log(`  Files in package: ${files.size}`);
    for (const name of files.keys()) {
      console.log(`    ${name}`);
    }
    console.log("");

    if (skipSignature) {
      // Content-only validation
      const clausesContent = files.get("content/clauses.json");
      if (!clausesContent) {
        console.error("Error: No content/clauses.json found in package");
        process.exit(1);
      }
      const result = validator.validateContentOnly(clausesContent.toString("utf-8"));
      if (result.valid) {
        console.log("✓ Content validation passed");
      } else {
        console.log("✗ Content validation failed");
        for (const error of result.errors) {
          console.log(`  - ${error.code}: ${error.message}`);
        }
        process.exit(1);
      }
      console.log("⊘ Signature verification skipped (--skip-signature)");
    } else {
      // Full validation including signature
      if (!signature) {
        console.error("Error: No signature.sig found in package");
        process.exit(1);
      }

      const result = await validator.validatePackage(files, signature);
      if (result.valid) {
        console.log("✓ Manifest validation passed");
        console.log("✓ File integrity check passed");
        console.log("✓ Signature verification passed");
        console.log("✓ Content validation passed");
        if (result.manifest) {
          console.log(`\n  Skill: ${result.manifest.displayName} (${result.manifest.skillId})`);
          console.log(`  Version: ${result.manifest.version}`);
          console.log(`  Jurisdictions: ${result.manifest.jurisdictions.join(", ")}`);
          console.log(`  Languages: ${result.manifest.languages.join(", ")}`);
        }
      } else {
        console.log("✗ Verification failed\n");
        for (const error of result.errors) {
          console.log(`  - ${error.code}: ${error.message}`);
        }
        process.exit(1);
      }
      if (result.warnings?.length) {
        console.log("\nWarnings:");
        for (const w of result.warnings) {
          console.log(`  - ${w}`);
        }
      }
    }
  }

  console.log("\nVerification complete.");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
