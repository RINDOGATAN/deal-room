// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Jurisdiction tags vs. governing law.
 *
 * Skill/template jurisdiction tags are free-form strings
 * (`ContractTemplate.jurisdictions` is `String[]`) and can be more specific
 * than the `GoverningLaw` enum the deal engine runs on (CALIFORNIA, NEW_YORK,
 * ENGLAND_WALES, SPAIN, DELAWARE). The Delaware Certificate of Incorporation
 * is authored against the DGCL and tagged DELAWARE, so deals created from it
 * run under DELAWARE: a company's charter is governed by the law of its state
 * of incorporation, never by California.
 *
 * This module is the single place that bridges the two vocabularies. If a
 * new tag is added to a skill's metadata.json, map it here (and add it to
 * VALID_JURISDICTIONS in scripts/check-skills.mjs) or deal creation will
 * reject it.
 */

export type GoverningLaw = "CALIFORNIA" | "NEW_YORK" | "ENGLAND_WALES" | "SPAIN" | "DELAWARE";

export const SKILL_JURISDICTION_TO_GOVERNING_LAW: Record<string, GoverningLaw> = {
  CALIFORNIA: "CALIFORNIA",
  NEW_YORK: "NEW_YORK",
  ENGLAND_WALES: "ENGLAND_WALES",
  SPAIN: "SPAIN",
  // Delaware corporate documents (DGCL) are governed by Delaware law.
  DELAWARE: "DELAWARE",
};

/**
 * Resolve a skill/template jurisdiction tag to the GoverningLaw a deal
 * should be created under. Returns null for unknown tags so callers can
 * fail loudly instead of guessing.
 */
export function governingLawForSkillJurisdiction(tag: string): GoverningLaw | null {
  return SKILL_JURISDICTION_TO_GOVERNING_LAW[tag] ?? null;
}

/**
 * The governing law a startup-journey deal is created under: CALIFORNIA (the
 * journey's US default) when the template offers it or has no tags, else the
 * template's own first law, so the Delaware Certificate of Incorporation runs
 * under DELAWARE.
 */
export function journeyGoverningLaw(tags: string[]): GoverningLaw {
  const laws = tags
    .map((t) => governingLawForSkillJurisdiction(t))
    .filter((l): l is GoverningLaw => l !== null);
  if (laws.length === 0 || laws.includes("CALIFORNIA")) return "CALIFORNIA";
  return laws[0];
}

/**
 * Display metadata for jurisdiction tags: flag emoji + the i18n key under
 * `newDeal.jurisdictions.*`. Jurisdictions and contract languages must never
 * share a visual format (a "ES" pill can mean Spain or Spanish) — always
 * render jurisdictions as flag + full name and languages as plain words.
 */
export const JURISDICTION_DISPLAY: Record<string, { flag: string; tKey: string }> = {
  CALIFORNIA: { flag: "🇺🇸", tKey: "california" },
  NEW_YORK: { flag: "🇺🇸", tKey: "newYork" },
  DELAWARE: { flag: "🇺🇸", tKey: "delaware" },
  ENGLAND_WALES: { flag: "🇬🇧", tKey: "englandWales" },
  SPAIN: { flag: "🇪🇸", tKey: "spain" },
};

/** Contract language names, written in the language itself (no i18n needed). */
export const CONTRACT_LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Español",
};
