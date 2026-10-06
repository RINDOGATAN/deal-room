// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One rule for how an agent-facing surface presents a contract type's
 * inputs, so the guides' agent blocks, /developers and its Markdown twin,
 * /.well-known/mcp.json, /llms-full.txt, GET /api/v1/agent/contract-types
 * and the MCP tool descriptions cannot disagree.
 *
 * The rule: every required input is listed as required. When it has a
 * default, the listing says so and names the default: an agent may leave
 * it out of `terms` and the one call applies that default (see
 * `withDefaults` in generateContract.ts, which uses the same test for a
 * default: present and not empty).
 */

export interface InputFacts {
  id: string;
  /** Absent means required (the snapshot holds required inputs only). */
  required?: boolean;
  default?: string;
  /** Only asked under these governing laws (absent: under all of them). */
  onlyUnder?: string[];
}

export type InputLocale = "en" | "es";

/** The default applied when the input is left out, if it has one. */
export function inputDefault(i: InputFacts): string | undefined {
  return typeof i.default === "string" && i.default !== "" ? i.default : undefined;
}

/** Whether the input applies under a governing law (no law given: always). */
export function appliesUnder(i: InputFacts, law?: string | null): boolean {
  return !law || !i.onlyUnder?.length || i.onlyUnder.includes(law);
}

/** The required inputs (under `law`, when given), with or without a default. */
export function requiredInputs<T extends InputFacts>(inputs: readonly T[] | undefined, law?: string | null): T[] {
  return (inputs ?? []).filter((i) => i.required !== false && appliesUnder(i, law));
}

/** A required input the caller must send: it has no default to fall back on. */
export function mustSend(i: InputFacts): boolean {
  return i.required !== false && inputDefault(i) === undefined;
}

export const INPUT_WORDS: Record<
  InputLocale,
  { onlyUnder: (laws: string) => string; ifLeftOut: (value: string) => string }
> = {
  en: {
    onlyUnder: (laws) => `only under ${laws}`,
    ifLeftOut: (value) => `if left out, the default ${value} is applied`,
  },
  es: {
    onlyUnder: (laws) => `solo con ${laws}`,
    ifLeftOut: (value) => `si no lo envías, se aplica el valor por defecto ${value}`,
  },
};

/** The notes on an input: where it applies and the default applied if it is left out. */
export function inputNotes(
  i: InputFacts,
  locale: InputLocale = "en",
  lawName: (law: string) => string = (l) => l,
): string[] {
  const words = INPUT_WORDS[locale];
  const value = inputDefault(i);
  return [
    ...(i.onlyUnder?.length ? [words.onlyUnder(i.onlyUnder.map(lawName).join(", "))] : []),
    ...(value !== undefined ? [words.ifLeftOut(value)] : []),
  ];
}

/** "id" or "id (only under Spain; if left out, the default Madrid is applied)". */
export function describeInput(
  i: InputFacts,
  locale: InputLocale = "en",
  lawName?: (law: string) => string,
): string {
  const notes = inputNotes(i, locale, lawName);
  return notes.length ? `${i.id} (${notes.join("; ")})` : i.id;
}

/** The defaults of the required inputs that have one, by id (empty when none). */
export function defaultsIfLeftOut(inputs: readonly InputFacts[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of requiredInputs(inputs)) {
    const value = inputDefault(i);
    if (value !== undefined) out[i.id] = value;
  }
  return out;
}

/** The sentence every surface uses to explain the rule. */
export const REQUIRED_INPUTS_RULE: Record<InputLocale, string> = {
  en: "Send every required input in terms. A required input with a default can be left out: the default is applied.",
  es: "Envía en terms todos los datos obligatorios. Un dato obligatorio con valor por defecto puede omitirse: se aplica ese valor.",
};
