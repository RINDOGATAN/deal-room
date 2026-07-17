// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Grounded compromise-reasoning prompt builder ("Explain with AI").
 *
 * Builds the prompts for an AI explanation of a suggestion the deterministic
 * compromise engine (services/compromise/engine.ts) ALREADY computed. The AI
 * never picks options or changes numbers — it only narrates the engine's
 * output (stakes, weights, satisfaction scores, selected option, round) in
 * plain language. Pure functions — no network, no DB. Callers pass the
 * posture gate first and send the result through the one LLM Door.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

// ---------------------------------------------------------------------------
// Types (plain data so the builder stays pure and unit-testable)
// ---------------------------------------------------------------------------

export interface CompromisePartyInput {
  /** Role label only ("Party A (initiator)" side) — never a name or email. */
  selectedOptionLabel: string;
  priority: number; // 1-5 (engine input, kept for transparency)
  flexibility: number; // 1-5
  /** Engine stake score = ((5-flexibility)/5 × 0.6) + (|bias| × 0.4). */
  stake: number;
}

export interface CompromiseReasoningInput {
  clauseTitle: string;
  roundNumber: number;
  options: { label: string; order: number }[];
  partyA: CompromisePartyInput;
  partyB: CompromisePartyInput;
  suggestion: {
    suggestedOptionLabel: string;
    satisfactionPartyA: number; // 0-100 (engine output, immutable)
    satisfactionPartyB: number; // 0-100 (engine output, immutable)
    deterministicReasoning: string;
  };
}

/** The stake weights the engine uses — surfaced so the AI can explain them. */
export const STAKE_WEIGHTS = { firmness: 0.6, bias: 0.4 } as const;

const LOCALE_INSTRUCTIONS: Record<string, string> = {
  en: "Write the explanation in English.",
  es: "Redacta la explicación en español de España (castellano peninsular), tratando al lector de tú.",
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export function buildCompromiseReasoningSystemPrompt(locale: string = "en"): string {
  const languageLine = LOCALE_INSTRUCTIONS[locale] ?? LOCALE_INSTRUCTIONS.en;

  return `You are a senior contract negotiation advisor. A deterministic compromise algorithm has ALREADY selected a suggested option for one contract clause, based on each party's selections, flexibility, and option bias scores. Your job is ONLY to explain that existing suggestion in clear, neutral plain language for both parties.

Guidelines:
- ${languageLine}
- The suggestion is final: never propose a different option, never question or recalculate the scores, and never invent numbers not present in the context.
- Explain WHY the suggested option balances the two positions, referring to the stakes (firmness weighted ${STAKE_WEIGHTS.firmness}, option bias weighted ${STAKE_WEIGHTS.bias}), flexibility, and satisfaction scores provided.
- Refer to the parties only as "Party A (initiator)" and "Party B (respondent)" — never use personal or company names.
- Neutral tone: do not advocate for either party.
- This is an explanatory note, not legal advice — do not give legal advice.
- Answer with a single short paragraph or two, 120-200 words, no headings.`;
}

export function buildCompromiseReasoningUserPrompt(
  input: CompromiseReasoningInput
): string {
  const { clauseTitle, roundNumber, options, partyA, partyB, suggestion } = input;
  const parts: string[] = [];

  parts.push(`## Clause: ${clauseTitle}`);
  parts.push(`**Negotiation round:** ${roundNumber}`);

  parts.push(`\n## Available options (in order)`);
  for (const opt of options) {
    parts.push(`${opt.order}. ${opt.label}`);
  }

  parts.push(`\n## Party A (initiator)`);
  parts.push(`**Selected:** ${partyA.selectedOptionLabel}`);
  parts.push(`**Priority:** ${partyA.priority}/5`);
  parts.push(`**Flexibility:** ${partyA.flexibility}/5`);
  parts.push(`**Computed stake:** ${partyA.stake.toFixed(2)}`);

  parts.push(`\n## Party B (respondent)`);
  parts.push(`**Selected:** ${partyB.selectedOptionLabel}`);
  parts.push(`**Priority:** ${partyB.priority}/5`);
  parts.push(`**Flexibility:** ${partyB.flexibility}/5`);
  parts.push(`**Computed stake:** ${partyB.stake.toFixed(2)}`);

  parts.push(`\n## Engine suggestion (final — do not change)`);
  parts.push(`**Suggested option:** ${suggestion.suggestedOptionLabel}`);
  parts.push(`**Satisfaction Party A:** ${suggestion.satisfactionPartyA}/100`);
  parts.push(`**Satisfaction Party B:** ${suggestion.satisfactionPartyB}/100`);
  parts.push(`**Engine's own summary:** ${suggestion.deterministicReasoning}`);

  parts.push(
    "\n---\nExplain to both parties why this suggestion is a reasonable balance of their positions, grounded strictly in the data above."
  );

  return parts.join("\n");
}
