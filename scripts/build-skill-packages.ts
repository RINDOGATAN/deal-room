#!/usr/bin/env npx tsx
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Build .skill packages from raw skill directories.
 *
 * Reads premium skill directories (those with manifest.json), bundles their
 * content into signed .skill ZIP archives ready for upload to Vercel Blob.
 *
 * Required env vars:
 *   SKILLS_DIR                  Path to legalskills repo (default: ./legalskills)
 *   SKILL_SIGNING_PRIVATE_KEY   Ed25519 private key PEM (optional; skips signing if absent)
 *
 * Usage:
 *   tsx scripts/build-skill-packages.ts                         # Build all premium skills
 *   tsx scripts/build-skill-packages.ts advertising-io          # Build specific skill(s)
 *   tsx scripts/build-skill-packages.ts --out ./packages        # Custom output directory
 *
 * Output:
 *   dist/com.nel.skills.advertising-io.skill    (ZIP)
 *   dist/com.nel.skills.affiliate-program.skill (ZIP)
 *   ...
 */

import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";
import { sha256, computePackageHash, signEd25519 } from "../src/lib/crypto";

// ── Config ───────────────────────────────────────────────

const skillsDir = path.resolve(process.env.SKILLS_DIR || "./legalskills");
const args = process.argv.slice(2);
const outFlag = args.indexOf("--out");
const outDir = outFlag >= 0 ? path.resolve(args[outFlag + 1]) : path.resolve("./dist");
const specificSkills = args.filter((a) => !a.startsWith("--") && (outFlag < 0 || args.indexOf(a) !== outFlag + 1));
const privateKeyPem = process.env.SKILL_SIGNING_PRIVATE_KEY || null;

// ── Types ────────────────────────────────────────────────

interface RawManifest {
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

// ── Helpers ──────────────────────────────────────────────

function readJsonSafe<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(skillsDir)) {
    console.error(`Error: Skills directory not found: ${skillsDir}`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  // Discover premium skills (those with manifest.json)
  const dirs = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        !d.name.startsWith(".") &&
        !d.name.startsWith("_") &&
        fs.existsSync(path.join(skillsDir, d.name, "manifest.json"))
    )
    .map((d) => d.name);

  // Filter to specific skills if requested
  const skillNames = specificSkills.length > 0
    ? dirs.filter((d) => specificSkills.includes(d))
    : dirs;

  if (skillNames.length === 0) {
    console.error("No skills to build.");
    process.exit(1);
  }

  console.log(`Building ${skillNames.length} skill package(s)...`);
  if (!privateKeyPem) {
    console.log("  (no SKILL_SIGNING_PRIVATE_KEY — packages will be unsigned)\n");
  } else {
    console.log("  (signing with Ed25519 private key)\n");
  }

  let built = 0;
  let failed = 0;

  for (const name of skillNames) {
    const skillDir = path.join(skillsDir, name);
    process.stdout.write(`  ${name}...`);

    try {
      const result = buildPackage(skillDir);
      console.log(` OK → ${result.filename} (${(result.size / 1024).toFixed(1)} KB)`);
      built++;
    } catch (error) {
      console.log(` FAILED: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  console.log(`\nDone: ${built} built, ${failed} failed → ${outDir}`);

  if (failed > 0) process.exit(1);
}

function buildPackage(skillDir: string): { filename: string; size: number } {
  // 1. Read manifest
  const manifest = readJsonSafe<RawManifest>(path.join(skillDir, "manifest.json"));
  if (!manifest) throw new Error("Cannot read manifest.json");

  // 2. Collect content files for the package
  const contentFiles = new Map<string, Buffer>();

  // Required: clauses.json → content/clauses.json
  const clausesPath = path.join(skillDir, "clauses.json");
  if (!fs.existsSync(clausesPath)) throw new Error("Missing clauses.json");
  contentFiles.set("content/clauses.json", fs.readFileSync(clausesPath));

  // Optional: boilerplate.json → content/boilerplate.json
  const boilerplatePath = path.join(skillDir, "boilerplate.json");
  if (fs.existsSync(boilerplatePath)) {
    contentFiles.set("content/boilerplate.json", fs.readFileSync(boilerplatePath));
  }

  // Optional: parameters.json
  const parametersPath = path.join(skillDir, "parameters.json");
  if (fs.existsSync(parametersPath)) {
    contentFiles.set("parameters.json", fs.readFileSync(parametersPath));
  }

  // 3. Compute file hashes
  const files: Record<string, string> = {};
  for (const [zipPath, content] of contentFiles) {
    files[zipPath] = sha256(content);
  }

  // 4. Build full manifest with files + createdAt
  const fullManifest = {
    skillId: manifest.skillId,
    name: manifest.name,
    displayName: manifest.displayName,
    version: manifest.version,
    ...(manifest.description ? { description: manifest.description } : {}),
    jurisdictions: manifest.jurisdictions,
    languages: manifest.languages,
    files,
    createdAt: new Date().toISOString(),
    ...(manifest.author ? { author: manifest.author } : {}),
    ...(manifest.license ? { license: manifest.license } : {}),
  };

  const manifestBuffer = Buffer.from(JSON.stringify(fullManifest, null, 2), "utf-8");

  // 5. Build the files map for hashing + signing
  const allFiles = new Map<string, Buffer>();
  allFiles.set("manifest.json", manifestBuffer);
  for (const [zipPath, content] of contentFiles) {
    allFiles.set(zipPath, content);
  }

  // 6. Sign the package (or create empty placeholder)
  let signatureBuffer: Buffer;
  if (privateKeyPem) {
    const packageHash = computePackageHash(allFiles);
    const dataToSign = Buffer.from(packageHash, "hex");
    signatureBuffer = signEd25519(dataToSign, privateKeyPem);
  } else {
    // Placeholder — unsigned package (validation will be skipped in dev mode)
    signatureBuffer = Buffer.alloc(0);
  }

  // 7. Create ZIP archive
  const zip = new AdmZip();
  zip.addFile("manifest.json", manifestBuffer);
  for (const [zipPath, content] of contentFiles) {
    zip.addFile(zipPath, content);
  }
  zip.addFile("signature.sig", signatureBuffer);

  // 8. Write to disk
  const filename = `${manifest.skillId}.skill`;
  const outputPath = path.join(outDir, filename);
  zip.writeZip(outputPath);

  const stat = fs.statSync(outputPath);
  return { filename, size: stat.size };
}

main();
