#!/usr/bin/env npx tsx
/**
 * CLI Command: skill:package
 *
 * Package a skill directory into a signed .skill archive (ZIP).
 *
 * Usage:
 *   npx deal-room skill:package ./skills/founders-agreement --key ./private.pem
 *   npx deal-room skill:package ./skills/founders-agreement --key ./private.pem --out ./dist
 */

import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";
import { sha256, computePackageHash, signEd25519 } from "../../src/lib/crypto";
import { SkillPackageValidator } from "../../src/server/services/skills/validator";

interface ManifestInput {
  skillId: string;
  name: string;
  displayName: string;
  version: string;
  description?: string;
  jurisdictions: string[];
  languages: string[];
  author?: string;
  license?: string;
  templateFamily?: string;
  nativeJurisdiction?: string;
}

export async function packageSkill(
  dirPath: string,
  privateKeyPath: string,
  outDir: string
): Promise<string> {
  // 1. Read manifest.json
  const manifestPath = path.join(dirPath, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No manifest.json found in ${dirPath}`);
  }
  const manifestInput: ManifestInput = JSON.parse(
    fs.readFileSync(manifestPath, "utf-8")
  );

  // 2. Read content files
  const contentFiles: { name: string; relativePath: string; buffer: Buffer }[] = [];
  const contentDir = dirPath; // Files are at root level in legalskills

  for (const filename of ["clauses.json", "boilerplate.json", "metadata.json"]) {
    const filePath = path.join(contentDir, filename);
    if (fs.existsSync(filePath)) {
      contentFiles.push({
        name: filename,
        relativePath: `content/${filename}`,
        buffer: fs.readFileSync(filePath),
      });
    }
  }

  if (!contentFiles.find((f) => f.name === "clauses.json")) {
    throw new Error(`No clauses.json found in ${dirPath}`);
  }

  // 3. Validate content
  const validator = new SkillPackageValidator();
  const clausesBuffer = contentFiles.find((f) => f.name === "clauses.json")!.buffer;
  const validation = validator.validateContentOnly(clausesBuffer.toString("utf-8"));
  if (!validation.valid) {
    const msgs = validation.errors.map((e) => `${e.code}: ${e.message}`);
    throw new Error(`Content validation failed:\n  ${msgs.join("\n  ")}`);
  }

  // 4. Build file hashes
  const fileHashes: Record<string, string> = {};
  for (const file of contentFiles) {
    fileHashes[file.relativePath] = sha256(file.buffer);
  }

  // 5. Build enriched manifest
  const enrichedManifest = {
    skillId: manifestInput.skillId,
    name: manifestInput.name,
    displayName: manifestInput.displayName,
    version: manifestInput.version,
    description: manifestInput.description,
    jurisdictions: manifestInput.jurisdictions,
    languages: manifestInput.languages || ["en"],
    author: manifestInput.author,
    license: manifestInput.license,
    files: fileHashes,
    createdAt: new Date().toISOString(),
  };

  const manifestBuffer = Buffer.from(JSON.stringify(enrichedManifest, null, 2), "utf-8");

  // 6. Compute package hash (manifest + content files)
  const allFiles = new Map<string, Buffer>();
  allFiles.set("manifest.json", manifestBuffer);
  for (const file of contentFiles) {
    allFiles.set(file.relativePath, file.buffer);
  }
  const packageHash = computePackageHash(allFiles);

  // 7. Sign the package hash
  const privateKeyPem = fs.readFileSync(privateKeyPath, "utf-8");
  const signature = signEd25519(Buffer.from(packageHash, "hex"), privateKeyPem);

  // 8. Create ZIP archive
  const zip = new AdmZip();
  zip.addFile("manifest.json", manifestBuffer);
  for (const file of contentFiles) {
    zip.addFile(file.relativePath, file.buffer);
  }
  zip.addFile("signature.sig", signature);

  // 9. Write output
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outputName = `${manifestInput.skillId}-${manifestInput.version}.skill`;
  const outputPath = path.join(outDir, outputName);
  zip.writeZip(outputPath);

  return outputPath;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: npx deal-room skill:package <directory> [options]

Package a skill directory into a signed .skill archive.

Arguments:
  directory         Path to skill directory (must contain manifest.json and clauses.json)

Options:
  --key <path>      Path to Ed25519 private key PEM file (required)
  --out <dir>       Output directory (default: ./dist)
  --help, -h        Show this help message

Examples:
  npx deal-room skill:package ./skills/founders-agreement --key ./private.pem
  npx deal-room skill:package /path/to/skill --key ./private.pem --out ./packages
`);
    process.exit(0);
  }

  const dirPath = path.resolve(args[0]);
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    console.error(`Error: Directory not found: ${dirPath}`);
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

  console.log(`Packaging skill: ${dirPath}`);

  try {
    const outputPath = await packageSkill(dirPath, keyPath, outDir);
    const stats = fs.statSync(outputPath);
    console.log(`\nPackage created: ${outputPath}`);
    console.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
  } catch (error) {
    console.error(`\nPackaging failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

// Only run main() when executed directly, not when imported
const isDirectRun =
  process.argv[1]?.endsWith("skill-package.ts") &&
  !process.argv[1]?.endsWith("skill-package-all.ts");

if (isDirectRun) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
