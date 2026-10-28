// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Gavel (dispute resolution) configuration.
 *
 * Read per request so a deployment that gains or loses the variables is
 * reflected without a rebuild, and so tests can toggle it. Both values are
 * required. The sovereign compose file injects empty strings for unset
 * variables, so "missing" means unset OR empty. There is deliberately no
 * default URL: without a key there is nothing to call, and a URL without a
 * key would only produce 401s downstream.
 */
export function getGavelConfig(): { apiUrl: string; apiKey: string } | null {
  const apiUrl = process.env.GAVEL_API_URL?.trim();
  const apiKey = process.env.GAVEL_API_KEY?.trim();
  if (!apiUrl || !apiKey) return null;
  return { apiUrl: apiUrl.replace(/\/+$/, ""), apiKey };
}

/**
 * Body returned (HTTP 503) by the dispute route when the hand-off cannot be
 * made. Documented in /docs/agent-api, section "Disputes".
 */
export const GAVEL_NOT_CONFIGURED_BODY = { error: "gavel_not_configured" } as const;

/**
 * Whether the escalation to Gavel is live. It is not: the hand-off below posts
 * to `<GAVEL_API_URL>/cases`, which Gavel does not serve (Gavel files disputes
 * at POST /v1/disputes under a clause every named party has accepted, with
 * party ids taken from the caller's key). Until both sides are rebuilt, the
 * route refuses with 501 and the code that calls Gavel is kept, unreached.
 * A function, not a constant, so tests can exercise the kept code path.
 */
export function isGavelEscalationAvailable(): boolean {
  return false;
}

/** Body returned (HTTP 501) while the escalation is planned. */
export const GAVEL_ESCALATION_PLANNED_BODY = {
  error: "gavel_escalation_planned",
  message: "Escalation to Gavel is planned and not yet available.",
} as const;
