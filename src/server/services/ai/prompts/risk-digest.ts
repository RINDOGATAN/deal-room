// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Pre-signature risk-digest prompt builder.
 *
 * Builds the prompts for a shared, markdown risk digest of the AGREED
 * contract, generated once for both parties before anyone signs. The input
 * shape deliberately carries deal parameters, agreed clause texts, and party
 * ROLE LABELS only — party names and emails must never enter the prompt
 * (extractRiskDigestInput enforces that when mapping from ContractData).
 * Pure functions — no network, no DB. Callers pass the posture gate first
 * and send the result through the one LLM Door.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

// ---------------------------------------------------------------------------
// Types (plain data so the builder stays pure and unit-testable)
// ---------------------------------------------------------------------------

export interface RiskDigestClause {
  title: string;
  agreedOptionLabel: string;
  legalText: string;
}

export interface RiskDigestInput {
  contractType: string;
  governingLaw: string;
  /** Contract output language ("en" | "es") — the digest matches it. */
  language: string;
  /** Role labels only (e.g. "Disclosing Party" / "Receiving Party"). */
  partyRoles: { partyA: string; partyB: string };
  /** Deal parameter values (id -> value) as they appear in the contract. */
  parameters: Record<string, string>;
  clauses: RiskDigestClause[];
}

/**
 * The minimal slice of the document generator's ContractData this feature
 * reads. Declared structurally so the extractor can be unit-tested with a
 * plain object that (like the real ContractData) DOES contain party names —
 * proving they never survive into the prompt input.
 */
export interface ContractDataLike {
  contractType: string;
  governingLaw: string;
  language: string;
  clauses: { title: string; agreedOption: string; legalText: string }[];
  boilerplate?: { partyLabels?: { partyA: string; partyB: string } } | null;
}

/**
 * Map ContractData + raw deal parameters to the prompt input, dropping every
 * party-identifying field (names, emails, addresses, signatories). This is
 * the ONLY sanctioned way to build a RiskDigestInput from deal data.
 */
export function extractRiskDigestInput(
  contract: ContractDataLike,
  parameters: Record<string, string>
): RiskDigestInput {
  return {
    contractType: contract.contractType,
    governingLaw: contract.governingLaw,
    language: contract.language,
    partyRoles: contract.boilerplate?.partyLabels ?? {
      partyA: "Party A (initiator)",
      partyB: "Party B (respondent)",
    },
    parameters,
    clauses: contract.clauses.map((c) => ({
      title: c.title,
      agreedOptionLabel: c.agreedOption,
      legalText: c.legalText,
    })),
  };
}

const LOCALE_INSTRUCTIONS: Record<string, string> = {
  en: "Write the digest in English.",
  es: "Redacta el resumen en español de España (castellano peninsular), tratando al lector de tú.",
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export function buildRiskDigestSystemPrompt(locale: string = "en"): string {
  const languageLine = LOCALE_INSTRUCTIONS[locale] ?? LOCALE_INSTRUCTIONS.en;

  return `You are a senior contracts lawyer preparing a short pre-signature risk digest of an already-negotiated agreement. Both parties will read the SAME digest, so it must be strictly neutral.

Guidelines:
- ${languageLine}
- Structure the digest in markdown with exactly these three sections (as "##" headings, translated to the output language): Key obligations; Risk allocation; Points to double-check before signing.
- Use short bullet points; reference clauses by their titles.
- Refer to the parties ONLY by the role labels provided in the context — never invent names.
- Ground every statement in the clause texts and parameters provided; do not invent terms, and do not speculate about facts outside the contract.
- Do not recommend renegotiating: the terms are agreed. Flag what each party should verify or be aware of.
- This is an informational summary, NOT legal advice — do not present it as advice and do not add your own disclaimer (the application displays one).
- Keep it under 450 words.`;
}

export function buildRiskDigestUserPrompt(input: RiskDigestInput): string {
  const parts: string[] = [];

  parts.push(`## Contract`);
  parts.push(`**Type:** ${input.contractType}`);
  parts.push(`**Governing law:** ${input.governingLaw}`);
  parts.push(`**Party roles:** ${input.partyRoles.partyA} / ${input.partyRoles.partyB}`);

  const paramEntries = Object.entries(input.parameters);
  if (paramEntries.length > 0) {
    parts.push(`\n## Deal parameters`);
    for (const [key, value] of paramEntries) {
      parts.push(`- ${key}: ${value}`);
    }
  }

  parts.push(`\n## Agreed clauses`);
  for (const clause of input.clauses) {
    parts.push(`\n### ${clause.title} — agreed option: ${clause.agreedOptionLabel}`);
    parts.push(clause.legalText);
  }

  parts.push(
    "\n---\nWrite the pre-signature risk digest for the agreement above."
  );

  return parts.join("\n");
}
