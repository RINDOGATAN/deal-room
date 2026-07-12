// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// Marketplace stubs (self-host discoverability).
//
// Reads the bundled storefront catalog (generated from todo.law/legalskills) and,
// for each premium skill NOT already installed, creates a metadata-only package +
// zero-clause template stub. These surface in the marketplace + deals/new picker
// as locked "get it on the marketplace" items linking to /legalskills/{slug}.
// Zero clauses means they can never open as an empty wizard — the UI treats a
// premium package whose template has no clauses as marketplace-only.
//
// Idempotent (upsert by skillId/contractType) and additive (never touches user
// data), so it runs on EVERY boot — including existing installs the full seed
// skips. Hosted seeds real content from SKILLS_DIR and must NOT call this.
import { Prisma, PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

interface CatalogSkill {
  skillId: string;
  slug: string;
  contractType: string;
  displayName: Record<string, string>;
  description?: Record<string, string>;
  category?: Record<string, string>;
  templateFamily?: string;
  jurisdictions?: string[];
  languages?: string[];
  version?: string;
}

export async function seedMarketplaceStubs(prisma: PrismaClient): Promise<void> {
  const catalogPath = path.join(__dirname, "premium-catalog.json");
  if (!fs.existsSync(catalogPath)) {
    console.log("  No premium-catalog.json — skipping marketplace stubs");
    return;
  }
  const catalog: CatalogSkill[] = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
  const en = (v?: Record<string, string>) =>
    v?.en ?? v?.es ?? Object.values(v ?? {})[0] ?? null;

  let created = 0;
  let linked = 0;
  for (const skill of catalog) {
    const displayName = en(skill.displayName) || skill.slug;
    const description = en(skill.description);
    const category = en(skill.category);

    const existing = await prisma.skillPackage.findUnique({
      where: { skillId: skill.skillId },
    });
    if (existing) {
      // Installed content already present — just record the storefront slug.
      await prisma.skillPackage.update({
        where: { skillId: skill.skillId },
        data: { marketplaceSlug: skill.slug, isPremium: true },
      });
      linked++;
      continue;
    }
    const pkg = await prisma.skillPackage.create({
      data: {
        skillId: skill.skillId,
        name: skill.contractType,
        displayName,
        version: skill.version || "1.0.0",
        packageHash: `stub:${skill.slug}`,
        jurisdictions: skill.jurisdictions ?? [],
        languages: skill.languages ?? [],
        isActive: true,
        isPremium: true,
        marketplaceSlug: skill.slug,
        description,
      },
    });
    await prisma.contractTemplate.upsert({
      where: { contractType: skill.contractType },
      create: {
        contractType: skill.contractType,
        displayName,
        description,
        skillPath: "",
        skillPackageId: pkg.id,
        templateFamily: skill.templateFamily || null,
        jurisdictions: skill.jurisdictions ?? [],
        languages: skill.languages ?? [],
        displayNameLocalized:
          (skill.displayName as Prisma.InputJsonValue) ?? Prisma.DbNull,
        descriptionLocalized:
          (skill.description as Prisma.InputJsonValue) ?? Prisma.DbNull,
        category,
        categoryLocalized:
          (skill.category as Prisma.InputJsonValue) ?? Prisma.DbNull,
        soloModeSupported: true,
      },
      update: { skillPackageId: pkg.id },
    });
    created++;
  }
  console.log(
    `  Marketplace stubs: ${created} created, ${linked} linked (of ${catalog.length} catalogued)`,
  );
}
