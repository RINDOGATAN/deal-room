#!/usr/bin/env npx tsx
/**
 * CLI Command: skill:list
 *
 * List installed skill packages.
 *
 * Usage:
 *   npx deal-room skill:list
 *   npx deal-room skill:list --json
 */

import { SkillPackageInstaller } from "../../src/server/services/skills/installer";

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: npx deal-room skill:list [options]

List all installed skill packages.

Options:
  --json        Output as JSON
  --help, -h    Show this help message
`);
    process.exit(0);
  }

  const installer = new SkillPackageInstaller();
  const packages = await installer.listInstalled();

  if (jsonOutput) {
    console.log(JSON.stringify(packages, null, 2));
    return;
  }

  if (packages.length === 0) {
    console.log("No skill packages installed.");
    return;
  }

  console.log("\nInstalled Skill Packages:");
  console.log("=".repeat(70));

  for (const pkg of packages) {
    console.log(`
Skill ID:      ${pkg.skillId}
Name:          ${pkg.displayName}
Version:       ${pkg.version}
Jurisdictions: ${pkg.jurisdictions.join(", ")}
Languages:     ${pkg.languages.join(", ")}
Active:        ${pkg.isActive ? "Yes" : "No"}
Installed:     ${pkg.installedAt.toISOString()}
Template:      ${pkg.contractTemplate?.contractType || "Not linked"}
Entitlements:  ${pkg._count.entitlements}
`);
    console.log("-".repeat(70));
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
