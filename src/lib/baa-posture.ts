// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The BAA's PHI posture (owner, 6 October 2026).
 *
 * The hosted BAA (BAA_NEGOTIATOR) is offered only in its springing posture:
 * for services designed not to receive protected health information
 * (`phi-by-design` = "no"). The conventional wording for services that do
 * handle it (`phi-by-design` = "yes") stays in the skill's boilerplate, but
 * no lawyer has reviewed it yet, so it is not offered: the skill lists only
 * "no", and every way in (the one call and MCP, the agent deals endpoint,
 * the new-deal wizard) refuses "yes" with the message below. Turn this on
 * only after that review, and add "yes" back to the skill's options.
 */

export const BAA_CONVENTIONAL_ENABLED = false;

export const BAA_CONTRACT_TYPE = "BAA_NEGOTIATOR";
export const BAA_PHI_PARAMETER = "phi-by-design";

export const BAA_CONVENTIONAL_REFUSAL =
  "This agreement is offered only for services designed not to receive protected health information. For services that handle it, a lawyer should prepare the agreement.";

/**
 * The refusal for inputs that ask for a posture not offered, or null when
 * they are fine. Any value other than "no" (in any case) is refused while
 * the conventional posture is off; an absent value takes the default "no".
 */
export function baaPostureRefusal(
  contractType: string | null | undefined,
  parameters: Record<string, string> | null | undefined,
): string | null {
  if (contractType !== BAA_CONTRACT_TYPE) return null;
  const value = (parameters?.[BAA_PHI_PARAMETER] ?? "").trim().toLowerCase();
  if (!value || value === "no") return null;
  if (BAA_CONVENTIONAL_ENABLED && value === "yes") return null;
  return BAA_CONVENTIONAL_REFUSAL;
}
