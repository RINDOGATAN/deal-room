#!/usr/bin/env npx tsx
/**
 * CLI Command: skill:install
 *
 * Install a skill package (.skill file or directory).
 *
 * Usage:
 *   npx deal-room skill:install ./nda.skill
 *   npx deal-room skill:install ./skills/nda/
 */

import { SkillPackageInstaller } from "../../src/server/services/skills/installer";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: npx deal-room skill:install <path>

Install a skill package from a .skill file or directory.

Arguments:
  path    Path to .skill package file or skill directory

Options:
  --help, -h    Show this help message

Examples:
  npx deal-room skill:install ./nda.skill
  npx deal-room skill:install ./skills/nda/
`);
    process.exit(0);
  }

  const packagePath = path.resolve(args[0]);

  if (!fs.existsSync(packagePath)) {
    console.error(`Error: Path not found: ${packagePath}`);
    process.exit(1);
  }

  const installer = new SkillPackageInstaller();
  const stats = fs.statSync(packagePath);

  console.log(`Installing skill from: ${packagePath}`);

  let result;
  if (stats.isDirectory()) {
    result = await installer.installFromDirectory(packagePath);
  } else if (packagePath.endsWith(".skill")) {
    result = await installer.installFromFile(packagePath);
  } else {
    console.error("Error: Path must be a .skill file or a directory");
    process.exit(1);
  }

  if (!result.success) {
    console.error("\nInstallation failed:");
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log("\nInstallation successful!");
  console.log(`  Skill Package ID: ${result.skillPackageId}`);
  console.log(`  Contract Template ID: ${result.contractTemplateId}`);

  if (result.warnings && result.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
