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
import {
  processBoilerplate,
  buildTransferAddendaSections,
  buildTiaImporterStatements,
} from "./generator";
import {
  buildBoilerplateVariables,
  findUnfilledParameterTokens,
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

describe("findUnfilledParameterTokens (sign-page blanks warning)", () => {
  const AGREED = [
    {
      legalText: "Governed by the laws of [governing law]; disputes before [competent courts].",
      clauseId: "governing-law-jurisdiction",
    },
    { legalText: "No tokens here.", clauseId: "data-transfer" },
  ];

  it("reports declared params whose tokens sit unfilled in agreed text", () => {
    const missing = findUnfilledParameterTokens(AGREED, {}, SCHEMA, "en");
    expect(missing.map((p) => p.id)).toEqual(["custom-governing-law", "custom-courts"]);
  });

  it("stays silent when values are present", () => {
    const missing = findUnfilledParameterTokens(
      AGREED,
      { "custom-governing-law": "Delaware", "custom-courts": "New York" },
      SCHEMA,
      "en",
    );
    expect(missing).toEqual([]);
  });

  it("treats a schema default as a value (include-tia never flags)", () => {
    const texts = [{ legalText: "See [transfer impact assessment].", clauseId: "x" }];
    expect(findUnfilledParameterTokens(texts, {}, SCHEMA, "en")).toEqual([]);
  });

  it("matches the localized Spanish spelling of a declared token", () => {
    const texts = [
      { legalText: "Se rige por [ley aplicable].", clauseId: "governing-law-jurisdiction" },
    ];
    expect(findUnfilledParameterTokens(texts, {}, SCHEMA, "es").map((p) => p.id)).toEqual([
      "custom-governing-law",
    ]);
  });

  it("respects clause scope — tokens in unrelated clauses don't flag", () => {
    const texts = [{ legalText: "Mentions [governing law].", clauseId: "data-transfer" }];
    expect(findUnfilledParameterTokens(texts, {}, SCHEMA, "en")).toEqual([]);
  });
});

describe("annex sections + contains operator (B-2 confirmable TOMs)", () => {
  const RAW_SECTIONS = {
    contractTitle: "DPA",
    preamble: "P.",
    signatureBlock: "S.",
    annexes: [
      {
        title: "Annex II",
        text: "Baseline: {processingPurpose}",
        sections: [
          {
            showIf: [{ variable: "tomsConfirmed", contains: "toms-network" }],
            text: "NETWORK SECURITY",
          },
          {
            showIf: [{ variable: "tomsConfirmed", contains: "toms-logging" }],
            text: "LOGGING",
          },
          {
            showIf: [{ variable: "tomsPhysical", in: ["provider-managed"] }],
            text: "PHYSICAL (PROVIDER)",
          },
        ],
      },
    ],
  };

  function annexText(variables: Record<string, string>): string {
    const bp = processBoilerplate(RAW_SECTIONS, "SPAIN", variables, "en");
    return bp?.annexes?.[0]?.text ?? "";
  }

  it("renders only the baseline when nothing is confirmed", () => {
    const text = annexText({ processingPurpose: "x" });
    expect(text).toBe("Baseline: x");
  });

  it("adds exactly the confirmed sections, in authored order", () => {
    const text = annexText({
      processingPurpose: "x",
      tomsConfirmed: "toms-logging,toms-network",
      tomsPhysical: "provider-managed",
    });
    expect(text).toBe(
      "Baseline: x\n\nNETWORK SECURITY\n\nLOGGING\n\nPHYSICAL (PROVIDER)",
    );
  });

  it("contains does not substring-match across option keys", () => {
    const text = annexText({ processingPurpose: "x", tomsConfirmed: "toms-network-extra" });
    expect(text).toBe("Baseline: x");
  });

  it("in-operator sections still work alongside contains sections", () => {
    const text = annexText({ processingPurpose: "x", tomsPhysical: "own-facilities" });
    expect(text).toBe("Baseline: x");
  });

  it("present-operator sections render only when the free-text answer exists", () => {
    const bp = (vars: Record<string, string>) =>
      processBoilerplate(
        {
          contractTitle: "DPA",
          preamble: "P.",
          signatureBlock: "S.",
          annexes: [
            {
              title: "Annex I",
              text: "Scope.",
              sections: [
                {
                  showIf: [{ variable: "dataExcluded", present: true }],
                  text: "EXCLUDED: {dataExcluded}",
                },
              ],
            },
          ],
        },
        "SPAIN",
        vars,
        "en",
      )?.annexes?.[0]?.text;
    expect(bp({})).toBe("Scope.");
    expect(bp({ dataExcluded: "   " })).toBe("Scope.");
    expect(bp({ dataExcluded: "payment card data" })).toBe("Scope.\n\nEXCLUDED: payment card data");
  });
});

describe("TIA importer statements (B-6 — the TIA answers what it poses)", () => {
  it("hosted service defaults to the likely-ECSP conclusion", () => {
    const { tiaEcspStatement } = buildTiaImporterStatements({}, "en");
    expect(tiaEcspStatement).toContain("remote computing service");
    expect(tiaEcspStatement).toContain("18 U.S.C. § 2711");
  });

  it("non-hosted importer records reduced exposure", () => {
    const { tiaEcspStatement } = buildTiaImporterStatements(
      { "tia-importer-hosted": "no" },
      "en",
    );
    expect(tiaEcspStatement).toContain("unlikely to qualify");
  });

  it("unknown request history proceeds conservatively; declared none is documented", () => {
    expect(buildTiaImporterStatements({}, "en").tiaRequestHistoryStatement).toContain(
      "proceeds conservatively",
    );
    expect(
      buildTiaImporterStatements({ "tia-gov-requests-received": "none" }, "en")
        .tiaRequestHistoryStatement,
    ).toContain("has not received any government request");
  });

  it("renders Spanish variants", () => {
    const es = buildTiaImporterStatements({ "tia-gov-requests-received": "some" }, "es");
    expect(es.tiaEcspStatement).toContain("remote computing service");
    expect(es.tiaRequestHistoryStatement).toContain("informes de transparencia");
  });

  it("breach history: declared-none documented, some considered, unknown conservative", () => {
    expect(
      buildTiaImporterStatements({ "tia-breach-history": "none" }, "en").tiaBreachHistoryStatement,
    ).toContain("no personal data breach");
    expect(
      buildTiaImporterStatements({ "tia-breach-history": "some" }, "en").tiaBreachHistoryStatement,
    ).toContain("handling, remediation");
    expect(
      buildTiaImporterStatements({}, "en").tiaBreachHistoryStatement,
    ).toContain("next review");
  });
});

describe("UK Addendum / Swiss adaptations sections (Annex III §6–7)", () => {
  it("defaults to incorporating both when the deal recorded nothing", () => {
    const out = buildTransferAddendaSections({}, "en");
    expect(out).toContain("6. UNITED KINGDOM TRANSFERS");
    expect(out).toContain("incorporate by reference the International Data Transfer Addendum");
    expect(out).toContain("7. SWISS TRANSFERS");
    expect(out).toContain("FDPIC");
  });

  it("UK declined: falls back to the execute-separately notice", () => {
    const out = buildTransferAddendaSections({ "include-uk-addendum": "no" }, "en");
    expect(out).toContain("execute separately");
    expect(out).not.toContain("Table 1");
  });

  it("Swiss declined: §7 is omitted entirely", () => {
    const out = buildTransferAddendaSections({ "include-swiss-adaptations": "no" }, "en");
    expect(out).not.toContain("SWISS");
    expect(out).toContain("6. UNITED KINGDOM TRANSFERS");
  });

  it("Spanish rendering carries both sections", () => {
    const out = buildTransferAddendaSections({}, "es");
    expect(out).toContain("6. TRANSFERENCIAS DEL REINO UNIDO");
    expect(out).toContain("UK Addendum");
    expect(out).toContain("7. TRANSFERENCIAS SUIZAS");
    expect(out).toContain("PFPDT");
  });

  it("interpolates into an annex without leaving the placeholder behind", () => {
    const bp = processBoilerplate(
      {
        contractTitle: "DPA",
        preamble: "P.",
        signatureBlock: "S.",
        annexes: [
          {
            title: "Annex III",
            showIf: [{ variable: "processorEstablishment", in: ["US"] }],
            text: "5. PRECEDENCE\nText.\n\n{transferAddendaSections}",
          },
        ],
      },
      "SPAIN",
      {
        processorEstablishment: "US",
        transferAddendaSections: buildTransferAddendaSections({}, "en"),
      },
      "en",
    );
    const annex = bp?.annexes?.[0];
    expect(annex?.text).not.toContain("{transferAddendaSections}");
    expect(annex?.text).toContain("7. SWISS TRANSFERS");
  });
});
