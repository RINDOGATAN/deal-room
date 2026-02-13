#!/usr/bin/env npx tsx
/**
 * CLI Command: skill:package-all
 *
 * Batch-package all skills in a directory (e.g., the legalskills repo).
 *
 * Usage:
 *   npx deal-room skill:package-all /path/to/legalskills --key ./private.pem
 *   npx deal-room skill:package-all /path/to/legalskills --key ./private.pem --out ./dist
 */

import * as fs from "fs";
import * as path from "path";
import { packageSkill } from "./skill-package";

const SKIP_DIRS = new Set([".git", ".github", "_template", "node_modules"]);

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: npx deal-room skill:package-all <directory> [options]

Batch-package all skill directories found under the given path.

Arguments:
  directory         Root directory containing skill subdirectories (each must have manifest.json)

Options:
  --key <path>      Path to Ed25519 private key PEM file (required)
  --out <dir>       Output directory (default: ./dist)
  --help, -h        Show this help message

Examples:
  npx deal-room skill:package-all /path/to/legalskills --key ./private.pem
  npx deal-room skill:package-all /path/to/legalskills --key ./private.pem --out ./packages
`);
    process.exit(0);
  }

  const rootDir = path.resolve(args[0]);
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    console.error(`Error: Directory not found: ${rootDir}`);
    process.exit(1);
  }

  const keyIdx = args.indexOf("--key");
  if (keyIdx < 0 || !args[keyIdx + 1]) {
    console.error("Error: --key <path> is required (Ed25519 private key PEM file)");
    process.exit(1);
  }
  const keyPath = path.resolve(args[keyIdx + 1]);
  if (!fs.existsSync(keyPath)) {
    console.error(`Error: Key file not found: ${keyPath}`);
    process.exit(1);
  }

  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : path.resolve("./dist");

  // Find all subdirectories with a manifest.json
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const skillDirs = entries
    .filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name))
    .map((e) => path.join(rootDir, e.name))
    .filter((d) => fs.existsSync(path.join(d, "manifest.json")));

  if (skillDirs.length === 0) {
    console.error("No skill directories found (looked for subdirectories with manifest.json)");
    process.exit(1);
  }

  console.log(`Found ${skillDirs.length} skill(s) to package\n`);

  let succeeded = 0;
  let failed = 0;

  for (const dir of skillDirs) {
    const name = path.basename(dir);
    process.stdout.write(`  ${name}...`);

    try {
      const outputPath = await packageSkill(dir, keyPath, outDir);
      const stats = fs.statSync(outputPath);
      console.log(` OK (${(stats.size / 1024).toFixed(1)} KB)`);
      succeeded++;
    } catch (error) {
      console.log(` FAILED: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  console.log(`\nDone: ${succeeded} packaged, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
