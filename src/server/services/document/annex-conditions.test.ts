// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Conditional annex rendering (annex showIf).
 *
 * The DPA attaches Annex III (SCC incorporation) only when the processor is
 * established in a third country, and Annex IV (Transfer Impact Assessment)
 * only when, additionally, the parties opted in. Conditions are evaluated
 * against the interpolation variables; annexes without showIf must keep
 * rendering unconditionally (every pre-existing skill).
 */
import { describe, it, expect } from "vitest";
import { processBoilerplate } from "./generator";
import {
  buildBoilerplateVariables,
  interpolateParameters,
  type ParameterSchema,
} from "@/lib/parameters";

const RAW = {
  contractTitle: "DPA",
  preamble: "Preamble.",
  signatureBlock: "Signed.",
  annexes: [
    { title: "Annex I", text: "Always shown. Purpose: {processingPurpose}" },
    { title: "Annex II", text: "Also always shown." },
    {
      title: "Annex III — SCC Incorporation",
      showIf: [{ variable: "processorEstablishment", in: ["US", "OTHER"] }],
      text: "Processor established in {processorEstablishmentDisplay}.",
    },
    {
      title: "Annex IV — TIA",
      showIf: [
        { variable: "processorEstablishment", in: ["US", "OTHER"] },
        { variable: "includeTia", in: ["yes"] },
      ],
      text: "Measures:\n{tiaSafeguardsList}\nConclusion: {tiaConclusion}",
    },
  ],
};

function annexTitles(variables: Record<string, string>): string[] {
  const bp = processBoilerplate(RAW, "SPAIN", variables, "en");
  return (bp?.annexes ?? []).map((a) => a.title);
}

describe("annex showIf", () => {
  it("EEA processor: only the unconditional annexes render", () => {
    expect(annexTitles({ processorEstablishment: "EEA", processingPurpose: "x" })).toEqual([
      "Annex I",
      "Annex II",
    ]);
  });

  it("US processor without TIA opt-in: Annex III renders, Annex IV does not", () => {
    expect(
      annexTitles({ processorEstablishment: "US", includeTia: "no", processingPurpose: "x" }),
    ).toEqual(["Annex I", "Annex II", "Annex III — SCC Incorporation"]);
  });

  it("US processor with TIA opt-in: both conditional annexes render, ANDing the conditions", () => {
    expect(
      annexTitles({ processorEstablishment: "US", includeTia: "yes", processingPurpose: "x" }),
    ).toEqual([
      "Annex I",
      "Annex II",
      "Annex III — SCC Incorporation",
      "Annex IV — TIA",
    ]);
  });

  it("TIA opt-in alone (EEA processor) shows neither conditional annex", () => {
    expect(
      annexTitles({ processorEstablishment: "EEA", includeTia: "yes", processingPurpose: "x" }),
    ).toEqual(["Annex I", "Annex II"]);
  });

  it("missing variables fail closed — conditional annexes stay hidden", () => {
    expect(annexTitles({ processingPurpose: "x" })).toEqual(["Annex I", "Annex II"]);
  });

  it("interpolates variables inside a shown conditional annex", () => {
    const bp = processBoilerplate(
      RAW,
      "SPAIN",
      {
        processorEstablishment: "US",
        includeTia: "yes",
        processingPurpose: "x",
        processorEstablishmentDisplay: "the United States of America",
        tiaSafeguardsList: "(a) encryption in transit;",
        tiaConclusion: "Essentially equivalent protection ensured.",
      },
      "en",
    );
    const annexIV = bp?.annexes?.find((a) => a.title.startsWith("Annex IV"));
    expect(annexIV?.text).toContain("(a) encryption in transit;");
    expect(annexIV?.text).toContain("Essentially equivalent protection ensured.");
    const annexIII = bp?.annexes?.find((a) => a.title.startsWith("Annex III"));
    expect(annexIII?.text).toContain("the United States of America");
  });
});

const SCHEMA: ParameterSchema = {
  version: "1.0",
  parameters: [
    {
      id: "include-tia",
      token: "transfer impact assessment",
      scope: "*",
      type: "choice",
      required: false,
      default: "yes",
      boilerplateVariable: "includeTia",
      label: "TIA?",
    },
    {
      id: "custom-governing-law",
      token: "governing law",
      scope: "governing-law-jurisdiction",
      type: "text",
      required: false,
      label: "Custom governing law",
    },
    {
      id: "custom-courts",
      token: "competent courts",
      scope: "governing-law-jurisdiction",
      type: "text",
      required: false,
      label: "Custom courts",
    },
  ],
};

describe("boilerplate variables schema defaults", () => {
  it("falls back to the schema default when the deal never recorded the parameter", () => {
    expect(buildBoilerplateVariables({}, SCHEMA)).toEqual({ includeTia: "yes" });
  });

  it("an explicit deal value wins over the default", () => {
    expect(buildBoilerplateVariables({ "include-tia": "no" }, SCHEMA)).toEqual({
      includeTia: "no",
    });
  });
});

describe("custom governing law/courts clause tokens", () => {
  const EN =
    "This Agreement is governed by the laws of [governing law]. Disputes go to [competent courts].";
  const ES =
    "Este Acuerdo se rige por el Derecho de [ley aplicable]. Las controversias se someten a [tribunales competentes].";
  const params = {
    "custom-governing-law": "the State of Delaware",
    "custom-courts": "the courts of New York County, New York",
  };

  it("fills both tokens in English clause text, scoped to the clause", () => {
    const out = interpolateParameters(EN, params, SCHEMA, "governing-law-jurisdiction", "en");
    expect(out).toBe(
      "This Agreement is governed by the laws of the State of Delaware. Disputes go to the courts of New York County, New York.",
    );
  });

  it("fills the localised Spanish spellings via TOKEN_TRANSLATIONS", () => {
    const out = interpolateParameters(ES, params, SCHEMA, "governing-law-jurisdiction", "es");
    expect(out).not.toContain("[ley aplicable]");
    expect(out).not.toContain("[tribunales competentes]");
    expect(out).toContain("the State of Delaware");
  });

  it("does not apply the clause-scoped tokens to other clauses", () => {
    const out = interpolateParameters(EN, params, SCHEMA, "data-transfer", "en");
    expect(out).toContain("[governing law]");
  });

  it("leaves visible fill-in blanks when the custom option is chosen but the fields are empty", () => {
    const out = interpolateParameters(EN, {}, SCHEMA, "governing-law-jurisdiction", "en");
    expect(out).toContain("[governing law]");
    expect(out).toContain("[competent courts]");
  });
});
