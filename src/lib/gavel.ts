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
