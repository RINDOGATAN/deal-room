// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One-shot admin route — applies the "BAA polish" batch to the HOSTED
 * (Vercel/Neon) Deal Room database. It does BOTH of the following, in order,
 * idempotently, and NEVER deletes anything:
 *
 *   (1) RE-SEED `baa-negotiator` from the committed skill content at
 *       prisma/hosted-skills/baa-negotiator/, so the California governing law
 *       and the new Section 21(c) party-designated venue land on the hosted DB.
 *   (2) RETAG the legacy "Privacy" category to "Privacy & Data Protection"
 *       (category + categoryLocalized) across every ContractTemplate that still
 *       carries the old label — the dpa / privacy-notice consolidation.
 *
 * It supersedes the two prior one-shot routes (seed-baa + retag-privacy):
 * the operator runs a SINGLE curl and both effects land together.
 *
 * WHY THIS EXISTS
 * ----------------
 * The normal path is `npm run db:seed` (prisma/seed.ts) with SKILLS_DIR
 * pointing at the private legalskills checkout. That runs from the operator's
 * laptop and connects to Neon over Postgres port 5432. Some networks (WiFi +
 * hotspot both observed) block outbound 5432, so the local seed can't reach
 * the hosted DB. The hosted app itself runs inside AWS and reaches Neon fine,
 * so we let the deployed function perform the exact same per-skill upserts and
 * the in-place category retag.
 *
 * WHAT PART (1) DOES
 * ------------------
 * Replicates — byte-for-byte in behavior — the single-skill branch of
 * prisma/seed.ts for `com.nel.skills.baa-negotiator`, reading the skill
 * content committed at prisma/hosted-skills/baa-negotiator/:
 *   - SkillPackage    (upsert by skillId, packageHash = sha256 of clauses.json)
 *   - ContractTemplate (upsert by contractType, incl. category + jurisdictions)
 *   - ClauseTemplate  (upsert by [contractTemplateId, clauseId])
 *   - ClauseOption    (upsert by [clauseTemplateId, optionId])
 * plus the premium treatment the `premiumSkillIds` loop applies:
 *   isPremium=true, priceAmount=900, priceCurrency="eur",
 *   stripePriceId=process.env.STRIPE_PRICE_ID.
 *
 * WHAT PART (2) DOES
 * ------------------
 * A single idempotent updateMany:
 *   ContractTemplate WHERE category = "Privacy"
 *     -> category          = "Privacy & Data Protection"
 *     -> categoryLocalized = {"en":"Privacy & Data Protection",
 *                             "es":"Privacidad y Protección de Datos"}
 * Re-running matches zero rows once complete.
 *
 * Every write is an idempotent upsert/updateMany, so calling the route more
 * than once is safe.
 *
 * WHY THE SEED LOGIC IS DUPLICATED, NOT IMPORTED
 * ----------------------------------------------
 * prisma/seed.ts is a standalone script: it calls `main()` at module load,
 * instantiates its own PrismaClient, resolves paths from __dirname, and calls
 * process.exit() on failure. Importing it here would execute the ENTIRE
 * multi-table production seed as a side effect. So the helper functions and
 * the per-skill upsert block below are replicated verbatim from seed.ts (only
 * the Prisma client source differs — we use the shared, Neon-retry-wrapped
 * `@/lib/prisma` instead of a fresh client). Keep the two in sync if seed.ts's
 * per-skill logic changes.
 *
 * AUTH
 * ----
 * POST only. Caller must present SEED_BAA_TOKEN as a Bearer token.
 *   - SEED_BAA_TOKEN unset            -> 403 (never runs unguarded)
 *   - Authorization missing/mismatch  -> 401
 * The route is inert until called with the correct token, and is meant to be
 * removed (and the token unset) after a successful one-shot — see
 * BAA-POLISH-VERCEL.md.
 */

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// This route touches the database and reads committed files at request time.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SKILL_ID = "com.nel.skills.baa-negotiator";
const SKILL_CONTENT_DIR = path.join(
  process.cwd(),
  "prisma",
  "hosted-skills",
  "baa-negotiator",
);

// Part (2): legacy "Privacy" category consolidation (dpa / privacy-notice).
const FROM_CATEGORY = "Privacy";
const TO_CATEGORY = "Privacy & Data Protection";
const TO_CATEGORY_LOCALIZED = {
  en: "Privacy & Data Protection",
  es: "Privacidad y Protección de Datos",
} as const;

// ────────────────────────────────────────────────────────────
// i18n helpers — replicated verbatim from prisma/seed.ts
// ────────────────────────────────────────────────────────────

type LocalizedString = string | Record<string, string>;
type LocalizedArray = string[] | Record<string, string[]>;

interface ClauseOption {
  id: string;
  code: string;
  label: LocalizedString;
  order: number;
  plainDescription: LocalizedString;
  prosPartyA: LocalizedArray;
  consPartyA: LocalizedArray;
  prosPartyB: LocalizedArray;
  consPartyB: LocalizedArray;
  legalText: LocalizedString;
  biasPartyA: number;
  biasPartyB: number;
  jurisdictionConfig?: Record<string, unknown>;
}

interface Clause {
  id: string;
  title: LocalizedString;
  category: LocalizedString;
  order: number;
  plainDescription: LocalizedString;
  legalContext?: LocalizedString;
  isRequired?: boolean;
  options: ClauseOption[];
}

interface SkillClauses {
  contractType: string;
  displayName: LocalizedString;
  description?: LocalizedString;
  version: string;
  clauses: Clause[];
}

interface SkillMetadata {
  contractType: string;
  displayName: string | Record<string, string>;
  description?: string | Record<string, string>;
  category?: string | Record<string, string>;
  version: string;
  clauseCount: number;
  jurisdictions?: string[];
  languages?: string[];
  soloModeSupported?: boolean;
  soloModeDefault?: boolean;
  soloModeOnly?: boolean;
  templateFamily?: string;
}

interface SkillManifestAuthor {
  name: string;
  email?: string;
  stripeConnectAccountId?: string;
}

interface SkillManifest {
  skillId: string;
  name: string;
  displayName: string;
  version: string;
  jurisdictions: string[];
  languages: string[];
  author?: string | SkillManifestAuthor;
  license?: string;
  templateFamily?: string;
  nativeJurisdiction?: string;
}

function resolveString(
  value: string | Record<string, string> | undefined,
  fallback = "",
): string {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value.en || Object.values(value)[0] || fallback;
}

function resolveArray(
  value: string[] | Record<string, string[]> | undefined,
): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.en || Object.values(value)[0] || [];
}

function isLocalized(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildClauseLocalizedContent(
  clause: Clause,
): Record<string, unknown> | undefined {
  const content: Record<string, unknown> = {};
  let hasLocalized = false;

  if (isLocalized(clause.title)) {
    content.title = clause.title;
    hasLocalized = true;
  }
  if (isLocalized(clause.category)) {
    content.category = clause.category;
    hasLocalized = true;
  }
  if (isLocalized(clause.plainDescription)) {
    content.plainDescription = clause.plainDescription;
    hasLocalized = true;
  }
  if (clause.legalContext && isLocalized(clause.legalContext)) {
    content.legalContext = clause.legalContext;
    hasLocalized = true;
  }

  return hasLocalized ? content : undefined;
}

function buildOptionLocalizedContent(
  option: ClauseOption,
): Record<string, unknown> | undefined {
  const content: Record<string, unknown> = {};
  let hasLocalized = false;

  if (isLocalized(option.label)) {
    content.label = option.label;
    hasLocalized = true;
  }
  if (isLocalized(option.plainDescription)) {
    content.plainDescription = option.plainDescription;
    hasLocalized = true;
  }
  if (isLocalized(option.prosPartyA)) {
    content.prosPartyA = option.prosPartyA;
    hasLocalized = true;
  }
  if (isLocalized(option.consPartyA)) {
    content.consPartyA = option.consPartyA;
    hasLocalized = true;
  }
  if (isLocalized(option.prosPartyB)) {
    content.prosPartyB = option.prosPartyB;
    hasLocalized = true;
  }
  if (isLocalized(option.consPartyB)) {
    content.consPartyB = option.consPartyB;
    hasLocalized = true;
  }
  if (isLocalized(option.legalText)) {
    content.legalText = option.legalText;
    hasLocalized = true;
  }

  return hasLocalized ? content : undefined;
}

function inferJurisdictionsFromClauses(data: SkillClauses): string[] {
  const jurisdictions = new Set<string>();
  for (const clause of data.clauses) {
    for (const option of clause.options) {
      if (option.jurisdictionConfig) {
        for (const key of Object.keys(option.jurisdictionConfig)) {
          jurisdictions.add(key);
        }
      }
    }
  }
  return jurisdictions.size > 0 ? Array.from(jurisdictions) : [];
}

function inferLanguagesFromClauses(data: SkillClauses): string[] {
  for (const clause of data.clauses) {
    for (const option of clause.options) {
      if (isLocalized(option.label)) {
        return Object.keys(option.label as Record<string, string>);
      }
    }
  }
  return ["en"];
}

// ────────────────────────────────────────────────────────────
// Route
// ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const SEED_BAA_TOKEN = process.env.SEED_BAA_TOKEN;

  // 403 when the guard secret is not configured, so the route can never run
  // unguarded even if it is accidentally deployed without the env var.
  if (!SEED_BAA_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "SEED_BAA_TOKEN is not configured on the server." },
      { status: 403 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.replace(/^Bearer\s+/i, "");
  if (!provided || provided !== SEED_BAA_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const clausesPath = path.join(SKILL_CONTENT_DIR, "clauses.json");
    const metadataPath = path.join(SKILL_CONTENT_DIR, "metadata.json");
    const manifestPath = path.join(SKILL_CONTENT_DIR, "manifest.json");
    const boilerplatePath = path.join(SKILL_CONTENT_DIR, "boilerplate.json");

    if (!fs.existsSync(clausesPath)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Skill content not found at ${SKILL_CONTENT_DIR} (clauses.json missing).`,
        },
        { status: 500 },
      );
    }

    // Raw bytes of clauses.json — hashed exactly as seed.ts does so the
    // packageHash matches a local seed byte-for-byte.
    const clausesContent = fs.readFileSync(clausesPath, "utf-8");
    const clausesData: SkillClauses = JSON.parse(clausesContent);

    let metadata: SkillMetadata | null = null;
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    }

    let manifest: SkillManifest | null = null;
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    }

    let boilerplate: Record<string, unknown> | null = null;
    if (fs.existsSync(boilerplatePath)) {
      boilerplate = JSON.parse(fs.readFileSync(boilerplatePath, "utf-8"));
    }

    if (!manifest) {
      return NextResponse.json(
        { ok: false, error: "manifest.json missing — cannot seed a licensed premium skill." },
        { status: 500 },
      );
    }

    // Track whether the SkillPackage already existed, to report created/updated.
    const preExisting = await prisma.skillPackage.findUnique({
      where: { skillId: manifest.skillId },
      select: { id: true },
    });

    // ── SkillPackage (licensing) ──
    const packageHash = crypto
      .createHash("sha256")
      .update(clausesContent)
      .digest("hex");

    const skillPackage = await prisma.skillPackage.upsert({
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
      },
    });

    // Sync publisher info from manifest author object (no-op when author is a
    // plain string, as it is for baa-negotiator — kept for fidelity with seed.ts).
    const authorObj =
      manifest.author && typeof manifest.author === "object"
        ? manifest.author
        : null;
    if (authorObj?.email) {
      const authorUser = await prisma.user.findUnique({
        where: { email: authorObj.email },
        select: { id: true },
      });
      if (authorUser) {
        await prisma.skillPackage.update({
          where: { id: skillPackage.id },
          data: { authorId: authorUser.id },
        });
        if (authorObj.stripeConnectAccountId) {
          await prisma.lawyerProfile.updateMany({
            where: { userId: authorUser.id },
            data: { stripeConnectAccountId: authorObj.stripeConnectAccountId },
          });
        }
      }
    }

    // Resolve jurisdictions / languages / display fields exactly as seed.ts.
    const jurisdictions =
      metadata?.jurisdictions ||
      manifest?.jurisdictions ||
      inferJurisdictionsFromClauses(clausesData);
    const languages =
      metadata?.languages ||
      manifest?.languages ||
      inferLanguagesFromClauses(clausesData);

    const displayNameLocalized = isLocalized(clausesData.displayName)
      ? clausesData.displayName
      : metadata?.displayName && isLocalized(metadata.displayName)
        ? metadata.displayName
        : undefined;

    const descriptionLocalized =
      metadata?.description && isLocalized(metadata.description)
        ? metadata.description
        : isLocalized(clausesData.description)
          ? clausesData.description
          : undefined;

    const resolvedDisplayName =
      resolveString(clausesData.displayName) ||
      resolveString(metadata?.displayName) ||
      "BAA-NEGOTIATOR";
    const resolvedDescription =
      resolveString(metadata?.description) ||
      resolveString(clausesData.description);

    const categoryLocalized =
      metadata?.category && isLocalized(metadata.category)
        ? metadata.category
        : undefined;
    const resolvedCategory = resolveString(metadata?.category) || null;

    // ── ContractTemplate ──
    const template = await prisma.contractTemplate.upsert({
      where: { contractType: clausesData.contractType },
      create: {
        contractType: clausesData.contractType,
        displayName: resolvedDisplayName,
        description: resolvedDescription,
        version: clausesData.version || metadata?.version || "1.0",
        skillPath: SKILL_CONTENT_DIR,
        skillPackageId: skillPackage.id,
        templateFamily:
          manifest?.templateFamily || metadata?.templateFamily || null,
        nativeJurisdiction: (manifest?.nativeJurisdiction as never) || null,
        boilerplate: (boilerplate as Prisma.InputJsonValue) ?? Prisma.DbNull,
        jurisdictions,
        languages,
        displayNameLocalized:
          (displayNameLocalized as Prisma.InputJsonValue) ?? Prisma.DbNull,
        descriptionLocalized:
          (descriptionLocalized as Prisma.InputJsonValue) ?? Prisma.DbNull,
        category: resolvedCategory,
        categoryLocalized:
          (categoryLocalized as Prisma.InputJsonValue) ?? Prisma.DbNull,
        soloModeSupported: metadata?.soloModeSupported ?? false,
        soloModeDefault: metadata?.soloModeDefault ?? false,
        soloModeOnly: metadata?.soloModeOnly ?? false,
        isActive: true,
      },
      update: {
        displayName: resolvedDisplayName,
        description: resolvedDescription,
        version: clausesData.version || metadata?.version,
        skillPath: SKILL_CONTENT_DIR,
        skillPackageId: skillPackage.id,
        templateFamily:
          manifest?.templateFamily || metadata?.templateFamily || null,
        nativeJurisdiction: (manifest?.nativeJurisdiction as never) || null,
        boilerplate: (boilerplate as Prisma.InputJsonValue) ?? Prisma.DbNull,
        jurisdictions,
        languages,
        displayNameLocalized:
          (displayNameLocalized as Prisma.InputJsonValue) ?? Prisma.DbNull,
        descriptionLocalized:
          (descriptionLocalized as Prisma.InputJsonValue) ?? Prisma.DbNull,
        category: resolvedCategory,
        categoryLocalized:
          (categoryLocalized as Prisma.InputJsonValue) ?? Prisma.DbNull,
        soloModeSupported: metadata?.soloModeSupported ?? false,
        soloModeDefault: metadata?.soloModeDefault ?? false,
        soloModeOnly: metadata?.soloModeOnly ?? false,
      },
    });

    // ── ClauseTemplate + ClauseOption ──
    let clauseCount = 0;
    let optionCount = 0;
    for (const clause of clausesData.clauses) {
      const clauseLocalized = buildClauseLocalizedContent(clause);

      const clauseTemplate = await prisma.clauseTemplate.upsert({
        where: {
          contractTemplateId_clauseId: {
            contractTemplateId: template.id,
            clauseId: clause.id,
          },
        },
        create: {
          contractTemplateId: template.id,
          clauseId: clause.id,
          title: resolveString(clause.title),
          category: resolveString(clause.category),
          order: clause.order,
          plainDescription: resolveString(clause.plainDescription),
          legalContext: resolveString(clause.legalContext),
          isRequired: clause.isRequired ?? true,
          localizedContent:
            (clauseLocalized as Prisma.InputJsonValue) ?? Prisma.DbNull,
        },
        update: {
          title: resolveString(clause.title),
          category: resolveString(clause.category),
          order: clause.order,
          plainDescription: resolveString(clause.plainDescription),
          legalContext: resolveString(clause.legalContext),
          isRequired: clause.isRequired ?? true,
          localizedContent:
            (clauseLocalized as Prisma.InputJsonValue) ?? Prisma.DbNull,
        },
      });
      clauseCount++;

      for (const option of clause.options) {
        const optionLocalized = buildOptionLocalizedContent(option);

        await prisma.clauseOption.upsert({
          where: {
            clauseTemplateId_optionId: {
              clauseTemplateId: clauseTemplate.id,
              optionId: option.id,
            },
          },
          create: {
            clauseTemplateId: clauseTemplate.id,
            optionId: option.id,
            code: option.code,
            label: resolveString(option.label),
            order: option.order,
            plainDescription: resolveString(option.plainDescription),
            prosPartyA: resolveArray(option.prosPartyA),
            consPartyA: resolveArray(option.consPartyA),
            prosPartyB: resolveArray(option.prosPartyB),
            consPartyB: resolveArray(option.consPartyB),
            legalText: resolveString(option.legalText),
            biasPartyA: option.biasPartyA ?? 0,
            biasPartyB: option.biasPartyB ?? 0,
            jurisdictionConfig: option.jurisdictionConfig as
              | Prisma.InputJsonValue
              | undefined,
            localizedContent:
              (optionLocalized as Prisma.InputJsonValue) ?? Prisma.DbNull,
          },
          update: {
            code: option.code,
            label: resolveString(option.label),
            order: option.order,
            plainDescription: resolveString(option.plainDescription),
            prosPartyA: resolveArray(option.prosPartyA),
            consPartyA: resolveArray(option.consPartyA),
            prosPartyB: resolveArray(option.prosPartyB),
            consPartyB: resolveArray(option.consPartyB),
            legalText: resolveString(option.legalText),
            biasPartyA: option.biasPartyA ?? 0,
            biasPartyB: option.biasPartyB ?? 0,
            jurisdictionConfig: option.jurisdictionConfig as
              | Prisma.InputJsonValue
              | undefined,
            localizedContent:
              (optionLocalized as Prisma.InputJsonValue) ?? Prisma.DbNull,
          },
        });
        optionCount++;
      }
    }

    // ── Premium treatment (mirrors seed.ts premiumSkillIds loop) ──
    const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || null;
    const premium = await prisma.skillPackage.update({
      where: { skillId: SKILL_ID },
      data: {
        isPremium: true,
        stripePriceId: STRIPE_PRICE_ID,
        priceAmount: 900,
        priceCurrency: "eur",
      },
    });

    // ── Part (2): consolidate legacy "Privacy" -> "Privacy & Data Protection" ──
    // Count first so the response reports how many rows carried the legacy
    // label, independent of the update result (idempotent: 0 after first run).
    const categoriesMatched = await prisma.contractTemplate.count({
      where: { category: FROM_CATEGORY },
    });
    const categoriesResult = await prisma.contractTemplate.updateMany({
      where: { category: FROM_CATEGORY },
      data: {
        category: TO_CATEGORY,
        categoryLocalized:
          TO_CATEGORY_LOCALIZED as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      ok: true,
      baa: {
        updated: !!preExisting,
        version: premium.version,
        jurisdictions,
        packageHash,
      },
      categories: {
        matched: categoriesMatched,
        updated: categoriesResult.count,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `BAA polish failed: ${message}` },
      { status: 500 },
    );
  }
}
