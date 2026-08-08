// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * DPA wizard cross-validation (isomorphic, pure).
 *
 * The Transfer Impact Assessment's supplementary-measure selections are
 * representations to a supervisory authority, so selections that contradict
 * the user's other answers must be surfaced before the deal is created.
 * Returns warning ids; the wizard renders them via i18n and gates creation
 * behind an explicit confirmation while any are present.
 */

/** Data categories transferred in directly identifying form — incompatible
 *  with an unqualified "pseudonymization before transfer" claim. */
const IDENTIFYING_CATEGORIES = [
  "contact-details",
  "identification-data",
  "financial-data",
  "account-credentials",
];

export type DpaWarningId =
  | "pseudonymizationVsCategories"
  | "euResidencyThirdCountry";

export function validateTiaSelections(
  values: Record<string, string>
): DpaWarningId[] {
  const establishment = (values["processor-establishment"] || "").trim();
  // The TIA and its measures only render for third-country processors;
  // selections are inert otherwise, so don't nag about them.
  if (establishment !== "US" && establishment !== "OTHER") return [];

  const split = (v?: string) =>
    (v || "").split(",").map((s) => s.trim()).filter(Boolean);
  const categories = split(values["data-categories"]);
  const safeguards = split(values["tia-safeguards"]);

  const warnings: DpaWarningId[] = [];
  if (
    safeguards.includes("tech-pseudonymization") &&
    categories.some((c) => IDENTIFYING_CATEGORIES.includes(c))
  ) {
    warnings.push("pseudonymizationVsCategories");
  }
  if (safeguards.includes("tech-eu-residency")) {
    warnings.push("euResidencyThirdCountry");
  }
  return warnings;
}
