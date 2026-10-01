// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import {
  SCORE,
  acronymOf,
  localizedValues,
  normalizeSearchText,
  scoreContract,
  searchContracts,
  type SearchableContract,
} from "../contract-search";
import { catalogueEntries } from "../skill-catalogue";

/** The real catalogue (built-in skills, the hosted BAA and the premium catalogue). */
const catalogue: SearchableContract[] = catalogueEntries().map((e) => ({
  codes: [e.contractType],
  families: [e.templateFamily],
  names: localizedValues(e.displayName),
  descriptions: localizedValues(e.description),
  categories: localizedValues(e.category),
}));

const top = (query: string) => searchContracts(query, catalogue, (c) => c)[0]?.codes[0];

describe("contract search", () => {
  it("normalizes case and accents", () => {
    expect(normalizeSearchText("Cesión de PI — Art. 28")).toBe("cesion de pi art 28");
  });

  it("derives acronyms from display names", () => {
    expect(acronymOf("Non-Disclosure Agreement")).toBe("nda");
    expect(acronymOf("Data Processing Agreement")).toBe("dpa");
    expect(acronymOf("Master Services Agreement")).toBe("msa");
    expect(acronymOf("Employment Contract (Contrato Laboral)")).toBe("ec");
  });

  it.each([
    ["nda", "NDA"],
    ["NDA", "NDA"],
    ["mutual nda", "NDA"],
    ["dpa", "DPA"],
    ["DPA", "DPA"],
    ["data processing addendum", "DPA"],
    ["art. 28", "DPA"],
    ["encargo del tratamiento", "DPA"],
    ["confidencialidad", "NDA"],
    ["acuerdo de confidencialidad", "NDA"],
    ["hipaa", "BAA_NEGOTIATOR"],
    ["saas", "SAAS"],
    ["SaaS", "SAAS"],
    ["msa", "MSA"],
    ["statement of work", "MSA"],
    ["privacy policy", "PRIVACY_NOTICE"],
    ["aviso de privacidad", "PRIVACY_NOTICE"],
    ["TIA", "DPA"],
    ["convertible", "CONVERTIBLE_NOTE"],
    ["term sheet", "TERM_SHEET"],
    ["pacto de socios", "PACTO_SOCIOS"],
  ])("%s finds %s first", (query, code) => {
    expect(top(query)).toBe(code);
  });

  it("matches word prefixes, not inner fragments", () => {
    const nda = catalogue.find((c) => c.codes[0] === "NDA")!;
    expect(scoreContract("confid", nda)).toBeGreaterThan(0);
    expect(scoreContract("dential", nda)).toBe(0);
  });

  it("finds consulting, contractor and freelancer contracts", () => {
    const codes = searchContracts("freelancer", catalogue, (c) => c).map((c) => c.codes[0]);
    expect(codes).toContain("CONSULTING");
    expect(codes).toContain("CONTRATO_SERVICIOS");
  });

  it("finds both employment contracts in Spanish", () => {
    const codes = searchContracts("contrato de trabajo", catalogue, (c) => c).map((c) => c.codes[0]);
    expect(codes).toEqual(expect.arrayContaining(["EMPLOYMENT", "CONTRATO_LABORAL"]));
  });

  it("ranks code and alias matches above name, then description matches", () => {
    const item: SearchableContract = {
      codes: ["NDA"],
      names: ["Non-Disclosure Agreement"],
      descriptions: ["Protects sensitive business information"],
      categories: ["IP"],
    };
    expect(scoreContract("nda", item)).toBe(SCORE.EXACT);
    expect(scoreContract("confidentiality", item)).toBe(SCORE.EXACT);
    expect(scoreContract("non disc", item)).toBe(SCORE.ALIAS);
    expect(scoreContract("disclosure agreement", item)).toBe(SCORE.NAME);
    expect(scoreContract("sensitive", item)).toBe(SCORE.DESCRIPTION);
  });

  it("returns nothing for a well-spelled query no contract covers", () => {
    expect(searchContracts("mortgage", catalogue, (c) => c)).toEqual([]);
    expect(searchContracts("prenuptial agreement", catalogue, (c) => c)).toEqual([]);
  });

  it("returns every item for an empty query", () => {
    expect(searchContracts("  ", catalogue, (c) => c)).toHaveLength(catalogue.length);
  });
});
