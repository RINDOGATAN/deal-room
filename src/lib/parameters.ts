// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Deal Parameters — shared interpolation utility
 *
 * Isomorphic (browser + Node). Replaces [bracket] tokens in clause legalText
 * with deal-specific parameter values, scoped by clauseId.
 */

// ── Types ──────────────────────────────────────────────

export type ParameterType =
  | "text"
  | "textarea"
  | "currency"
  | "number"
  | "percentage"
  | "date"
  | "choice"
  | "multiSelect";

export interface ParameterDefinition {
  id: string;
  token: string;
  scope: string; // clauseId or "*" for skill-wide
  type: ParameterType;
  required: boolean;
  label: string | Record<string, string>;
  hint?: string | Record<string, string>;
  placeholder?: string | Record<string, string>;
  default?: string;
  options?: string[]; // for "choice"/"multiSelect" — canonical (English) values
  /** Localized display labels for `options`, keyed by canonical value. */
  optionLabels?: Record<string, string | Record<string, string>>;
  boilerplateVariable?: string; // also inject into {curly} boilerplate
  negotiable?: boolean; // if true, counterparty can propose changes during review
  jurisdictions?: string[]; // if set, only collected for these governing-law jurisdictions
}

export interface ParameterSchema {
  version: string;
  parameters: ParameterDefinition[];
}

// ── Token translation map ──────────────────────────────
// Maps English tokens → localized equivalents for multilingual clause text.

const TOKEN_TRANSLATIONS: Record<string, Record<string, string>> = {
  amount: { es: "importe" },
  number: { es: "número" },
  price: { es: "precio" },
  percentage: { es: "porcentaje" },
  months: { es: "meses" },
  county: { es: "condado" },
  city: { es: "ciudad" },
  threshold: { es: "umbral" },
  date: { es: "fecha" },
  minimum: { es: "mínimo" },
  maximum: { es: "máximo" },
  jurisdiction: { es: "jurisdicción" },
  address: { es: "dirección" },
  "start date": { es: "fecha de inicio" },
  "end date": { es: "fecha de fin" },
  "geographic area": { es: "área geográfica" },
  "description of services": { es: "descripción de servicios" },
  "base amount": { es: "importe base" },
  "time zone": { es: "zona horaria" },
  "subject matter/project": { es: "materia/proyecto" },
  "milestone 1": { es: "hito 1" },
  "milestone 2": { es: "hito 2" },
  "number of shares": { es: "número de participaciones" },
  "appointing body": { es: "órgano designante" },
  "arbitration institution": { es: "institución arbitral" },
  "arbitration language": { es: "idioma del arbitraje" },
  "campaign name": { es: "nombre de campaña" },
  rate: { es: "tarifa" },
  "program name": { es: "nombre del programa" },
  "prescribed disclosure text": { es: "texto de divulgación prescrito" },
  "named competitors": { es: "competidores designados" },
  "product category": { es: "categoría de producto" },
  "governing law": { es: "ley aplicable" },
  "competent courts": { es: "tribunales competentes" },
  territory: { es: "territorio" },
  "initial sub-processor list": { es: "lista inicial de subencargados" },
};

// ── Helpers ────────────────────────────────────────────

/** Resolve an i18n string value to a flat string */
export function resolveParamString(
  value: string | Record<string, string> | undefined,
  lang: string,
  fallback = ""
): string {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value[lang] || value.en || Object.values(value)[0] || fallback;
}

// ── Core interpolation ────────────────────────────────

/**
 * Replace [bracket] tokens in text with parameter values.
 *
 * @param text       - The clause legalText (already i18n-resolved)
 * @param params     - Map of parameter id → user-supplied value
 * @param schema     - Full parameter schema for this skill
 * @param clauseId   - The clauseId of the clause being interpolated
 * @param lang       - Contract language ("en", "es", …)
 */
export function interpolateParameters(
  text: string,
  params: Record<string, string>,
  schema: ParameterSchema | null | undefined,
  clauseId: string,
  lang: string = "en"
): string {
  if (!schema?.parameters?.length || !text) return text;

  let result = text;

  for (const param of schema.parameters) {
    // Only apply if scope matches this clause or is wildcard
    if (param.scope !== "*" && param.scope !== clauseId) continue;

    const value = params[param.id];
    if (!value) continue;

    // Build the token to search for in the current language
    const baseToken = param.token;
    const localizedToken =
      lang !== "en"
        ? TOKEN_TRANSLATIONS[baseToken.toLowerCase()]?.[lang] || baseToken
        : baseToken;

    // Replace case-insensitively: [token] → value
    const pattern = new RegExp(
      "\\[" + escapeRegExp(localizedToken) + "\\]",
      "gi"
    );
    result = result.replace(pattern, value);

    // Also replace the English token (some texts may have it even in non-en)
    if (lang !== "en") {
      const enPattern = new RegExp(
        "\\[" + escapeRegExp(baseToken) + "\\]",
        "gi"
      );
      result = result.replace(enPattern, value);
    }
  }

  return result;
}

/**
 * Interpolate all clauses in a list, returning new clause objects.
 * Suitable for both server (generator) and client (negotiate UI).
 */
export function interpolateClauseLegalTexts<
  T extends { legalText: string; clauseId?: string }
>(
  clauses: T[],
  params: Record<string, string>,
  schema: ParameterSchema | null | undefined,
  lang: string = "en"
): T[] {
  if (!schema?.parameters?.length) return clauses;

  return clauses.map((clause) => ({
    ...clause,
    legalText: interpolateParameters(
      clause.legalText,
      params,
      schema,
      clause.clauseId || "",
      lang
    ),
  }));
}

/**
 * Build a variables dict for boilerplate {curly} interpolation
 * from parameters that have `boilerplateVariable` set.
 */
export function buildBoilerplateVariables(
  params: Record<string, string>,
  schema: ParameterSchema | null | undefined
): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!schema?.parameters?.length) return vars;

  for (const param of schema.parameters) {
    // Schema defaults stand in for values the deal never recorded (agent-API
    // deals and deals created before the parameter existed), so conditional
    // boilerplate keyed on these variables behaves the same on every path.
    const value = params[param.id] || param.default;
    if (param.boilerplateVariable && value) {
      vars[param.boilerplateVariable] = value;
    }
  }
  return vars;
}

/**
 * Find declared parameters whose [token] still sits unfilled in the given
 * clause texts — i.e. the deal never recorded a value (and the schema has no
 * default), so the finished document would ship with a visible fill-in blank.
 * Used by the sign page to warn before signing. Clause options are chosen
 * after deal creation, so the creation wizard cannot catch these (e.g. the
 * "custom governing law and courts" option selected without its two fields).
 */
export function findUnfilledParameterTokens(
  clauses: Array<{ legalText: string; clauseId: string }>,
  params: Record<string, string>,
  schema: ParameterSchema | null | undefined,
  lang: string = "en"
): ParameterDefinition[] {
  if (!schema?.parameters?.length || !clauses.length) return [];
  const missing: ParameterDefinition[] = [];
  for (const param of schema.parameters) {
    const value = (params[param.id] ?? param.default ?? "").trim();
    if (value) continue;
    const tokens = [param.token.toLowerCase()];
    const localized =
      lang !== "en" ? TOKEN_TRANSLATIONS[param.token.toLowerCase()]?.[lang] : undefined;
    if (localized) tokens.push(localized.toLowerCase());
    const present = clauses.some(
      (c) =>
        (param.scope === "*" || param.scope === c.clauseId) &&
        tokens.some((tk) => c.legalText.toLowerCase().includes(`[${tk}]`))
    );
    if (present) missing.push(param);
  }
  return missing;
}

/**
 * Validate required parameters are present. Returns list of missing param ids.
 */
export function validateRequiredParameters(
  params: Record<string, string>,
  schema: ParameterSchema | null | undefined
): string[] {
  if (!schema?.parameters?.length) return [];

  return schema.parameters
    .filter((p) => p.required && !params[p.id]?.trim())
    .map((p) => p.id);
}

// ── Utility ───────────────────────────────────────────

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
