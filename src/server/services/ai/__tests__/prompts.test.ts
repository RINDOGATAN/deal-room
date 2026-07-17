/**
 * Prompt builders — pure unit tests (no network, no DB).
 *
 * Locks that prompts are locale-aware (en default, es Castilian), grounded
 * in the provided server-built context, that the compromise explanation
 * never invites the model to change the deterministic engine output, and —
 * critically — that party names/emails NEVER survive into the risk-digest
 * prompt (roles only).
 */

import { describe, it, expect } from "vitest";

import {
  buildCompromiseReasoningSystemPrompt,
  buildCompromiseReasoningUserPrompt,
  type CompromiseReasoningInput,
} from "../prompts/compromise-reasoning";
import {
  extractRiskDigestInput,
  buildRiskDigestSystemPrompt,
  buildRiskDigestUserPrompt,
} from "../prompts/risk-digest";

// ---------------------------------------------------------------------------
// Compromise reasoning
// ---------------------------------------------------------------------------

const compromiseInput: CompromiseReasoningInput = {
  clauseTitle: "Term of Confidentiality",
  roundNumber: 2,
  options: [
    { label: "1 year", order: 1 },
    { label: "3 years", order: 2 },
    { label: "5 years", order: 3 },
  ],
  partyA: {
    selectedOptionLabel: "5 years",
    priority: 4,
    flexibility: 2,
    stake: 0.52,
  },
  partyB: {
    selectedOptionLabel: "1 year",
    priority: 3,
    flexibility: 4,
    stake: 0.28,
  },
  suggestion: {
    suggestedOptionLabel: "3 years",
    satisfactionPartyA: 72,
    satisfactionPartyB: 64,
    deterministicReasoning:
      'For "Term of Confidentiality", Party A (initiator) has a higher stake in this clause.',
  },
};

describe("compromise-reasoning prompt builders", () => {
  it("system prompt is English by default and for unknown locales", () => {
    expect(buildCompromiseReasoningSystemPrompt()).toContain(
      "Write the explanation in English."
    );
    expect(buildCompromiseReasoningSystemPrompt("fr")).toContain(
      "Write the explanation in English."
    );
  });

  it("system prompt is Castilian Spanish for es", () => {
    const prompt = buildCompromiseReasoningSystemPrompt("es");
    expect(prompt).toContain("castellano peninsular");
    expect(prompt).not.toContain("Write the explanation in English.");
  });

  it("system prompt forbids changing the engine's decision", () => {
    const prompt = buildCompromiseReasoningSystemPrompt();
    expect(prompt).toContain("never propose a different option");
    expect(prompt).toContain("ALREADY selected");
  });

  it("user prompt is grounded in the engine's numeric output", () => {
    const prompt = buildCompromiseReasoningUserPrompt(compromiseInput);
    expect(prompt).toContain("Term of Confidentiality");
    expect(prompt).toContain("**Negotiation round:** 2");
    expect(prompt).toContain("**Selected:** 5 years");
    expect(prompt).toContain("**Selected:** 1 year");
    expect(prompt).toContain("**Computed stake:** 0.52");
    expect(prompt).toContain("**Computed stake:** 0.28");
    expect(prompt).toContain("**Suggested option:** 3 years");
    expect(prompt).toContain("**Satisfaction Party A:** 72/100");
    expect(prompt).toContain("**Satisfaction Party B:** 64/100");
    expect(prompt).toContain("final — do not change");
    expect(prompt).toContain(compromiseInput.suggestion.deterministicReasoning);
  });

  it("refers to parties by role only", () => {
    const prompt = buildCompromiseReasoningUserPrompt(compromiseInput);
    expect(prompt).toContain("Party A (initiator)");
    expect(prompt).toContain("Party B (respondent)");
  });
});

// ---------------------------------------------------------------------------
// Risk digest
// ---------------------------------------------------------------------------

// A ContractData-like fixture that DOES carry party names/emails (as the
// real document generator's output does) — extractRiskDigestInput must drop
// every one of these identifying strings before the prompt is built.
const contractDataWithNames = {
  contractType: "NDA",
  governingLaw: "Kingdom of Spain",
  language: "en",
  partyA: {
    name: "Alice Wonderland",
    email: "alice@acme-corp.example",
    company: "Acme Corp SL",
    legalName: "Acme Corporation S.L.",
    address: "Calle Mayor 1, Madrid",
    signatoryName: "Alice Wonderland",
  },
  partyB: {
    name: "Bob Builder",
    email: "bob@construct.example",
    company: "Construct Ltd",
  },
  clauses: [
    {
      title: "Term of Confidentiality",
      agreedOption: "3 years",
      legalText:
        "The confidentiality obligations shall remain in force for three (3) years.",
    },
    {
      title: "Governing Law",
      agreedOption: "Spain",
      legalText: "This Agreement shall be governed by the laws of Spain.",
    },
  ],
  boilerplate: {
    partyLabels: { partyA: "Disclosing Party", partyB: "Receiving Party" },
  },
};

const IDENTIFYING_STRINGS = [
  "Alice",
  "Wonderland",
  "alice@acme-corp.example",
  "Acme",
  "Bob",
  "Builder",
  "bob@construct.example",
  "Construct Ltd",
  "Calle Mayor",
];

describe("risk-digest input extraction (party names never enter the prompt)", () => {
  it("keeps only roles, params, and clause texts", () => {
    const input = extractRiskDigestInput(contractDataWithNames, {
      "term-years": "3",
    });

    expect(input.partyRoles).toEqual({
      partyA: "Disclosing Party",
      partyB: "Receiving Party",
    });
    expect(input.clauses).toHaveLength(2);
    // The extracted input carries no name/email fields at all
    expect(JSON.stringify(input)).not.toMatch(
      /Alice|Wonderland|alice@|Acme|Bob|Builder|bob@|Construct|Calle Mayor/
    );
  });

  it("falls back to generic role labels without boilerplate", () => {
    const input = extractRiskDigestInput(
      { ...contractDataWithNames, boilerplate: null },
      {}
    );
    expect(input.partyRoles).toEqual({
      partyA: "Party A (initiator)",
      partyB: "Party B (respondent)",
    });
  });

  it("party names NEVER appear in the built prompt", () => {
    const input = extractRiskDigestInput(contractDataWithNames, {
      "term-years": "3",
    });
    const prompt = buildRiskDigestUserPrompt(input);

    for (const s of IDENTIFYING_STRINGS) {
      expect(prompt).not.toContain(s);
    }
    // ...while the legitimate grounding survives
    expect(prompt).toContain("Disclosing Party");
    expect(prompt).toContain("Receiving Party");
    expect(prompt).toContain("Term of Confidentiality");
    expect(prompt).toContain("three (3) years");
    expect(prompt).toContain("- term-years: 3");
  });
});

describe("risk-digest prompt builders", () => {
  it("system prompt is English by default and Castilian for es", () => {
    expect(buildRiskDigestSystemPrompt()).toContain("Write the digest in English.");
    expect(buildRiskDigestSystemPrompt("es")).toContain("castellano peninsular");
  });

  it("system prompt demands roles-only references and no invented terms", () => {
    const prompt = buildRiskDigestSystemPrompt();
    expect(prompt).toContain("ONLY by the role labels");
    expect(prompt).toContain("never invent names");
    expect(prompt).toContain("NOT legal advice");
  });

  it("user prompt is grounded in contract type, law, and clauses", () => {
    const input = extractRiskDigestInput(contractDataWithNames, {});
    const prompt = buildRiskDigestUserPrompt(input);
    expect(prompt).toContain("**Type:** NDA");
    expect(prompt).toContain("**Governing law:** Kingdom of Spain");
    expect(prompt).toContain("### Governing Law — agreed option: Spain");
    expect(prompt).toContain("governed by the laws of Spain");
  });
});
