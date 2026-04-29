/**
 * Founder equity validation for the /launch quick-start flow.
 *
 * Rule (any-or-all + sum-to-100):
 *  - If no founder has an equity percent set, the journey is valid.
 *    (Legitimate case: equity not yet decided.)
 *  - If any founder has an equity percent set, every founder must have one,
 *    and the totals must sum to 100% within a 0.1 tolerance.
 *
 * Used by both the client (launch/new/page.tsx) and the server
 * (journey router zod refinement) so the rule cannot drift.
 */

export type EquityFounder = { equityPercent?: number | string | null };

export type EquityValidation =
  | { valid: true }
  | { valid: false; reason: "PARTIAL_EQUITY" | "DOES_NOT_SUM_TO_100"; total: number };

const TOLERANCE = 0.1;

function toNumberOrNull(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
}

export function validateEquity(founders: ReadonlyArray<EquityFounder>): EquityValidation {
  if (founders.length === 0) return { valid: true };

  const numeric = founders.map((f) => toNumberOrNull(f.equityPercent));
  const setCount = numeric.filter((v) => v !== null).length;

  if (setCount === 0) return { valid: true };

  if (setCount !== founders.length) {
    const total = numeric.reduce<number>((sum, v) => sum + (v ?? 0), 0);
    return { valid: false, reason: "PARTIAL_EQUITY", total };
  }

  const total = numeric.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  if (Math.abs(total - 100) > TOLERANCE) {
    return { valid: false, reason: "DOES_NOT_SUM_TO_100", total };
  }

  return { valid: true };
}
