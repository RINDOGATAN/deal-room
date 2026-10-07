// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Seed preview: what `npx prisma db seed` would change in a database,
 * without changing anything.
 *
 * Reads the same skill folders as prisma/seed.ts (skills/, then SKILLS_DIR
 * when set, else prisma/hosted-skills/), builds the values the seed would
 * write with the seed's own helpers (prisma/seed-values.ts) and compares
 * them with the database: per contract type, the template fields, every
 * clause and option, the rows the built-in prune would remove or retire,
 * and how many deals use the template (their documents are rendered from
 * the template, so a text change reaches them). It also lists the premium
 * price fields the seed rewrites and the demo fixtures it plants unless
 * SEED_SKILLS_ONLY=true.
 *
 * Every query runs inside a READ ONLY transaction, so the database refuses
 * any write.
 *
 *   DATABASE_URL="<unpooled URL>" npx tsx scripts/seed-preview.ts
 *   DATABASE_URL="<unpooled URL>" SKILLS_DIR=/path/to/legalskills npx tsx scripts/seed-preview.ts
 */

import { Prisma, PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { optionProsCons } from "../prisma/option-pros-cons";
import { describeReconcile, reconcileSkillClauses } from "../prisma/skill-reconcile";
import {
  A2A_SKILL_IDS,
  PREMIUM_SKILL_IDS,
  type SkillClauses,
  buildClauseLocalizedContent,
  buildOptionLocalizedContent,
  inferJurisdictionsFromClauses,
  inferLanguagesFromClauses,
  isLocalized,
  resolveArray,
  resolveString,
} from "../prisma/seed-values";

const ROOT = path.join(__dirname, "..");
const SKILLS_DIR = process.env.SKILLS_DIR || "";

/** Fields whose change alters the wording of a contract (the rest is guidance shown in the app). */
const CONTRACT_TEXT_FIELDS = new Set(["boilerplate", "legalText", "localizedContent", "parameterSchema"]);

function canonical(value: unknown): string {
  if (value === undefined || value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    return `{${Object.keys(rec)
      .filter((k) => rec[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(rec[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function readJson(file: string): Record<string, unknown> | null {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

function dirsIn(base: string): string[] {
  if (!base || !fs.existsSync(base)) return [];
  return fs
    .readdirSync(base)
    .filter((d) => !d.startsWith(".") && !d.startsWith("_") && fs.statSync(path.join(base, d)).isDirectory())
    .map((d) => path.join(base, d));
}

/** The skill folders the seed would read, in its order and with its overrides. */
function skillFolders(): { name: string; dir: string; builtin: boolean }[] {
  const out: { name: string; dir: string; builtin: boolean }[] = [];
  const put = (dir: string, builtin: boolean) => {
    const name = path.basename(dir);
    const i = out.findIndex((e) => e.name === name);
    if (i >= 0) out[i] = { name, dir, builtin };
    else out.push({ name, dir, builtin });
  };
  for (const d of dirsIn(path.join(ROOT, "skills"))) put(d, true);
  if (SKILLS_DIR) for (const d of dirsIn(SKILLS_DIR)) put(d, false);
  else for (const d of dirsIn(path.join(ROOT, "prisma", "hosted-skills"))) put(d, false);
  return out.filter((e) => fs.existsSync(path.join(e.dir, "clauses.json")));
}

type Tx = Prisma.TransactionClient;

interface Finding {
  skill: string;
  contractType: string;
  deals: number;
  lines: string[];
  contractText: boolean;
}

function compare(lines: string[], label: string, field: string, now: unknown, next: unknown, flag: () => void) {
  if (canonical(now) === canonical(next)) return;
  lines.push(`${label}: ${field} changes`);
  if (CONTRACT_TEXT_FIELDS.has(field)) flag();
}

async function previewSkill(tx: Tx, entry: { name: string; dir: string; builtin: boolean }): Promise<Finding> {
  const clausesData = readJson(path.join(entry.dir, "clauses.json")) as unknown as SkillClauses;
  const metadata = readJson(path.join(entry.dir, "metadata.json")) as Record<string, any> | null;
  const manifest = readJson(path.join(entry.dir, "manifest.json")) as Record<string, any> | null;
  const boilerplate = readJson(path.join(entry.dir, "boilerplate.json"));
  const parameterSchema = readJson(path.join(entry.dir, "parameters.json"));
  const presetsRaw = readJson(path.join(entry.dir, "presets.json"));
  const presets = Array.isArray(presetsRaw) ? presetsRaw : (presetsRaw?.presets ?? null);

  const finding: Finding = { skill: entry.name, contractType: clausesData.contractType, deals: 0, lines: [], contractText: false };
  const flag = () => (finding.contractText = true);

  // The SkillPackage (only skills with a manifest).
  if (manifest) {
    const pkg = await tx.skillPackage.findUnique({ where: { skillId: manifest.skillId } });
    const packageHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(entry.dir, "clauses.json"), "utf8")).digest("hex");
    if (!pkg) finding.lines.push(`skill package ${manifest.skillId}: would be created`);
    else {
      for (const [field, next] of Object.entries({
        name: manifest.name,
        displayName: manifest.displayName,
        version: manifest.version,
        packageHash,
        jurisdictions: manifest.jurisdictions,
        languages: manifest.languages,
      })) {
        compare(finding.lines, "skill package", field, (pkg as Record<string, unknown>)[field], next, flag);
      }
    }
  }

  const template = await tx.contractTemplate.findUnique({ where: { contractType: clausesData.contractType } });
  if (!template) {
    finding.lines.push("template: would be created (new contract type)");
    return finding;
  }
  finding.deals = await tx.dealRoom.count({ where: { contractTemplateId: template.id } });

  const displayNameLocalized = isLocalized(clausesData.displayName)
    ? clausesData.displayName
    : metadata?.displayName && isLocalized(metadata.displayName)
      ? metadata.displayName
      : null;
  const descriptionLocalized =
    metadata?.description && isLocalized(metadata.description)
      ? metadata.description
      : isLocalized(clausesData.description)
        ? clausesData.description
        : null;
  const next: Record<string, unknown> = {
    displayName: resolveString(clausesData.displayName) || resolveString(metadata?.displayName) || entry.name.toUpperCase(),
    description: resolveString(metadata?.description) || resolveString(clausesData.description),
    version: clausesData.version || metadata?.version,
    templateFamily: manifest?.templateFamily || metadata?.templateFamily || null,
    nativeJurisdiction: manifest?.nativeJurisdiction || metadata?.nativeJurisdiction || null,
    boilerplate,
    jurisdictions: metadata?.jurisdictions || manifest?.jurisdictions || inferJurisdictionsFromClauses(clausesData),
    languages: metadata?.languages || manifest?.languages || inferLanguagesFromClauses(clausesData),
    displayNameLocalized,
    descriptionLocalized,
    category: resolveString(metadata?.category) || null,
    categoryLocalized: metadata?.category && isLocalized(metadata.category) ? metadata.category : null,
    parameterSchema,
    presets,
    soloModeSupported: metadata?.soloModeSupported ?? false,
    soloModeDefault: metadata?.soloModeDefault ?? false,
    soloModeOnly: metadata?.soloModeOnly ?? false,
  };
  for (const [field, value] of Object.entries(next)) {
    compare(finding.lines, "template", field, (template as Record<string, unknown>)[field], value, flag);
  }

  const rows = await tx.clauseTemplate.findMany({
    where: { contractTemplateId: template.id },
    include: { options: true },
  });
  for (const clause of clausesData.clauses) {
    const row = rows.find((r) => r.clauseId === clause.id);
    if (!row) {
      finding.lines.push(`clause ${clause.id}: would be added`);
      flag();
      continue;
    }
    const c = {
      title: resolveString(clause.title),
      category: resolveString(clause.category),
      order: clause.order,
      plainDescription: resolveString(clause.plainDescription),
      legalContext: resolveString(clause.legalContext),
      isRequired: clause.isRequired ?? true,
      localizedContent: buildClauseLocalizedContent(clause) ?? null,
      retiredAt: null,
    };
    for (const [field, value] of Object.entries(c)) {
      // A clause's localizedContent is titles and descriptions, not contract wording.
      if (canonical((row as Record<string, unknown>)[field]) !== canonical(value)) {
        finding.lines.push(`clause ${clause.id}: ${field === "retiredAt" ? "would be revived" : `${field} changes`}`);
      }
    }
    for (const option of clause.options) {
      const opt = row.options.find((o) => o.optionId === option.id);
      if (!opt) {
        finding.lines.push(`option ${clause.id}/${option.id}: would be added`);
        flag();
        continue;
      }
      const pc = optionProsCons(option);
      const o = {
        code: option.code,
        label: resolveString(option.label),
        order: option.order,
        plainDescription: resolveString(option.plainDescription),
        prosPartyA: resolveArray(pc.prosPartyA),
        consPartyA: resolveArray(pc.consPartyA),
        prosPartyB: resolveArray(pc.prosPartyB),
        consPartyB: resolveArray(pc.consPartyB),
        legalText: resolveString(option.legalText),
        biasPartyA: option.biasPartyA ?? 0,
        biasPartyB: option.biasPartyB ?? 0,
        jurisdictionConfig: option.jurisdictionConfig ?? null,
        localizedContent: buildOptionLocalizedContent(option) ?? null,
        retiredAt: null,
      };
      for (const [field, value] of Object.entries(o)) {
        const now = (opt as Record<string, unknown>)[field];
        if (field === "jurisdictionConfig" && option.jurisdictionConfig === undefined) continue; // the seed leaves it as is
        if (canonical(now) === canonical(value)) continue;
        let what = field === "retiredAt" ? "would be revived" : `${field} changes`;
        if (field === "localizedContent") {
          const a = (now ?? {}) as Record<string, unknown>;
          const b = (value ?? {}) as Record<string, unknown>;
          const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => canonical(a[k]) !== canonical(b[k]));
          what = `translations change (${keys.sort().join(", ")})`;
        }
        finding.lines.push(`option ${clause.id}/${option.id}: ${what}`);
        if (field === "legalText") flag();
        if (field === "localizedContent") {
          const a = (now as Record<string, unknown> | null)?.legalText;
          const b = (value as Record<string, unknown> | null)?.legalText;
          if (canonical(a) !== canonical(b)) flag();
        }
      }
    }
  }

  if (entry.builtin && !template.skillPackageId) {
    const outcome = await reconcileSkillClauses(tx, template.id, clausesData, { dryRun: true });
    for (const line of describeReconcile(outcome)) finding.lines.push(`prune: ${line}`);
  }
  return finding;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        const folders = skillFolders();
        console.log(`Seed preview (read only). Skills the seed would read: ${folders.map((f) => f.name).join(", ")}\n`);
        for (const entry of folders) {
          const f = await previewSkill(tx, entry);
          const head = `${f.skill} (${f.contractType}), ${f.deals} deal(s) use it`;
          if (f.lines.length === 0) {
            console.log(`= ${head}: no change`);
            continue;
          }
          console.log(`${f.contractText ? "! " : "~ "}${head}: ${f.contractText ? "CONTRACT WORDING CHANGES" : "guidance or catalogue only"}`);
          for (const l of f.lines) console.log(`    ${l}`);
        }

        // The premium price fields the seed rewrites on every listed package present.
        const priceId = process.env.STRIPE_PRICE_ID || null;
        const packages = await tx.skillPackage.findMany({
          where: { skillId: { in: [...PREMIUM_SKILL_IDS, ...A2A_SKILL_IDS] } },
          select: { skillId: true, isPremium: true, stripePriceId: true, priceAmount: true, priceCurrency: true },
        });
        const priceChanges = packages.filter(
          (p) => p.isPremium !== true || p.stripePriceId !== priceId || p.priceAmount !== 900 || p.priceCurrency !== "eur",
        );
        console.log(`\nPremium price fields (isPremium, stripePriceId=${priceId ?? "null"}, 900, eur): ${priceChanges.length} of ${packages.length} listed packages present would be rewritten`);
        for (const p of priceChanges) console.log(`    ${p.skillId}: now ${p.isPremium}, ${p.stripePriceId ?? "null"}, ${p.priceAmount ?? "null"}, ${p.priceCurrency ?? "null"}`);

        const supervisor = await tx.supervisor.findUnique({ where: { email: "alex@example-firm.test" } });
        console.log(
          `\nDemo fixtures (fictional supervisor and two deployment experts) are written unless SEED_SKILLS_ONLY=true; the fictional supervisor is ${supervisor ? "already present" : "NOT present"} in this database.`,
        );
      },
      { timeout: 300_000, maxWait: 30_000 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
