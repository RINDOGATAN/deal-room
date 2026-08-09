// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import { dealHasTia, validateTiaSelections } from "../dpa-checks";

describe("dealHasTia (standalone TIA download visibility)", () => {
  it("true for US-processor DPA with TIA defaulted or included", () => {
    expect(dealHasTia("DPA", { "processor-establishment": "US" })).toBe(true);
    expect(dealHasTia("DPA", { "processor-establishment": "OTHER", "include-tia": "yes" })).toBe(true);
  });

  it("false when TIA declined, EEA/UK processor, other contract types, or no params", () => {
    expect(dealHasTia("DPA", { "processor-establishment": "US", "include-tia": "no" })).toBe(false);
    expect(dealHasTia("DPA", { "processor-establishment": "EEA" })).toBe(false);
    expect(dealHasTia("DPA", { "processor-establishment": "UK" })).toBe(false);
    expect(dealHasTia("MSA", { "processor-establishment": "US" })).toBe(false);
    expect(dealHasTia("DPA", null)).toBe(false);
  });
});

describe("validateTiaSelections (B-1 wizard cross-validation)", () => {
  it("flags pseudonymization claimed alongside directly identifying categories", () => {
    expect(
      validateTiaSelections({
        "processor-establishment": "US",
        "data-categories": "contact-details,usage-technical",
        "tia-safeguards": "tech-pseudonymization,tech-encryption-transit",
      }),
    ).toEqual(["pseudonymizationVsCategories"]);
  });

  it("accepts pseudonymization when only non-identifying categories transfer", () => {
    expect(
      validateTiaSelections({
        "processor-establishment": "US",
        "data-categories": "usage-technical,location-data",
        "tia-safeguards": "tech-pseudonymization",
      }),
    ).toEqual([]);
  });

  it("asks for confirmation of EEA residency with a third-country importer", () => {
    expect(
      validateTiaSelections({
        "processor-establishment": "OTHER",
        "data-categories": "contact-details",
        "tia-safeguards": "tech-eu-residency",
      }),
    ).toEqual(["euResidencyThirdCountry"]);
  });

  it("stays silent for EEA processors — the TIA never renders there", () => {
    expect(
      validateTiaSelections({
        "processor-establishment": "EEA",
        "data-categories": "contact-details",
        "tia-safeguards": "tech-pseudonymization,tech-eu-residency",
      }),
    ).toEqual([]);
  });

  it("can report both warnings at once", () => {
    expect(
      validateTiaSelections({
        "processor-establishment": "US",
        "data-categories": "identification-data",
        "tia-safeguards": "tech-pseudonymization,tech-eu-residency",
      }),
    ).toEqual(["pseudonymizationVsCategories", "euResidencyThirdCountry"]);
  });
});
