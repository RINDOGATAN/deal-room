#!/usr/bin/env npx tsx
/**
 * Upload skill packages to Vercel Blob and update the database.
 *
 * Reads .skill files from a directory (default: ./dist) and uploads them
 * to Vercel Blob storage, then updates the SkillPackage records with the URL.
 *
 * Required env vars:
 *   BLOB_READ_WRITE_TOKEN   Vercel Blob token
 *   DATABASE_URL             PostgreSQL connection string
 *
 * Usage:
 *   tsx scripts/upload-skill-packages.ts
 *   tsx scripts/upload-skill-packages.ts ./packages
 */

import * as fs from "fs";
import * as path from "path";
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import AdmZip from "adm-zip";

const prisma = new PrismaClient();

async function main() {
  const distDir = path.resolve(process.argv[2] || "./dist");

  if (!fs.existsSync(distDir)) {
    console.error(`Error: Directory not found: ${distDir}`);
    process.exit(1);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Error: BLOB_READ_WRITE_TOKEN env var is required");
    process.exit(1);
  }

  const files = fs.readdirSync(distDir).filter((f) => f.endsWith(".skill"));

  if (files.length === 0) {
    console.error(`No .skill files found in ${distDir}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} package(s) to upload\n`);

  let uploaded = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(distDir, file);
    const buffer = fs.readFileSync(filePath);

    // Extract skillId from the package manifest
    let skillId: string;
    try {
      const zip = new AdmZip(buffer);
      const manifestEntry = zip.getEntry("manifest.json");
      if (!manifestEntry) {
        console.log(`  ${file}... SKIP (no manifest.json)`);
        continue;
      }
      const manifest = JSON.parse(manifestEntry.getData().toString("utf-8"));
      skillId = manifest.skillId;
    } catch {
      console.log(`  ${file}... SKIP (invalid package)`);
      continue;
    }

    process.stdout.write(`  ${file} (${skillId})...`);

    try {
      // Upload to Vercel Blob
      const blob = await put(`skills/${file}`, buffer, {
        access: "public",
        contentType: "application/zip",
      });

      // Update database
      await prisma.skillPackage.update({
        where: { skillId },
        data: {
          packageUrl: blob.url,
          packageSize: buffer.length,
        },
      });

      console.log(` OK (${(buffer.length / 1024).toFixed(1)} KB)`);
      uploaded++;
    } catch (error) {
      console.log(` FAILED: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  console.log(`\nDone: ${uploaded} uploaded, ${failed} failed`);

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  prisma.$disconnect();
  process.exit(1);
});
