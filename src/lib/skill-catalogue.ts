// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The contract types the hosted catalogue offers, read from the repository:
 * the built-in skills (`skills/`), the bundled hosted skills
 * (`prisma/hosted-skills/`) and the premium catalogue
 * (`prisma/premium-catalog.json`), one entry per contract type. Reads the
 * file system, so server and build time only.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

type Localized = Partial<Record<"en" | "es", string>>;

export interface CatalogueEntry {
  contractType: string;
  displayName: Localized;
  description: Localized;
  category: Localized;
  jurisdictions: string[];
  languages: string[];
  templateFamily: string | null;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function localized(value: unknown): Localized {
  if (typeof value === "string") return { en: value };
  const out: Localized = {};
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    for (const l of ["en", "es"] as const) {
      if (typeof rec[l] === "string" && rec[l]) out[l] = rec[l] as string;
    }
  }
  return out;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toEntry(raw: Record<string, unknown>): CatalogueEntry {
  return {
    contractType: String(raw.contractType),
    displayName: localized(raw.displayName),
    description: localized(raw.description),
    category: localized(raw.category),
    jurisdictions: strings(raw.jurisdictions),
    languages: strings(raw.languages),
    templateFamily: typeof raw.templateFamily === "string" && raw.templateFamily ? raw.templateFamily : null,
  };
}

/** Fill the gaps of `a` from `b` (the first source wins where both have a value). */
function merge(a: CatalogueEntry, b: CatalogueEntry): CatalogueEntry {
  return {
    contractType: a.contractType,
    displayName: { ...b.displayName, ...a.displayName },
    description: { ...b.description, ...a.description },
    category: { ...b.category, ...a.category },
    jurisdictions: a.jurisdictions.length ? a.jurisdictions : b.jurisdictions,
    languages: a.languages.length ? a.languages : b.languages,
    templateFamily: a.templateFamily ?? b.templateFamily,
  };
}

let cache: CatalogueEntry[] | null = null;

export function catalogueEntries(): CatalogueEntry[] {
  if (cache) return cache;
  const byType = new Map<string, CatalogueEntry>();
  const add = (raw: unknown) => {
    if (!raw || typeof raw !== "object" || !("contractType" in raw)) return;
    const entry = toEntry(raw as Record<string, unknown>);
    const seen = byType.get(entry.contractType);
    byType.set(entry.contractType, seen ? merge(seen, entry) : entry);
  };

  // Read while prerendering only (the pages that use this are static), so
  // the build must not copy the project into the server bundle for it.
  const skillFolders = [
    join(/*turbopackIgnore: true*/ process.cwd(), "skills"),
    join(/*turbopackIgnore: true*/ process.cwd(), "prisma", "hosted-skills"),
  ];
  for (const base of skillFolders) {
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base, { withFileTypes: true })) {
      const meta = join(base, name.name, "metadata.json");
      if (name.isDirectory() && existsSync(meta)) add(readJson(meta));
    }
  }
  const premium = join(process.cwd(), "prisma", "premium-catalog.json");
  if (existsSync(premium)) for (const raw of readJson(premium) as unknown[]) add(raw);

  cache = [...byType.values()];
  return cache;
}

export function catalogueEntry(contractType: string): CatalogueEntry | undefined {
  return catalogueEntries().find((e) => e.contractType === contractType);
}
