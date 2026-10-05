// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Solo first (owner decision 2b, 4 October 2026).
 *
 * A template declares solo support in its skill metadata
 * (`skills/<name>/metadata.json`, seeded into `ContractTemplate`):
 * `soloModeSupported` (offers "I fill it in myself"), `soloModeDefault`
 * (solo with no mode step) and `soloModeOnly` (no two-party mode at all).
 *
 * In the new-deal wizard, every template that supports solo now starts in
 * solo, on hosted as on self-host. Where the template also offers two
 * parties (supported, not default, not only), the mode step stays visible
 * with solo selected first, so negotiating with a counterparty is one click
 * away. Templates without solo support keep the two-party mode.
 */

export type DealModeChoice = "SOLO" | "NEGOTIATION";

export interface SoloFlags {
  soloModeSupported?: boolean | null;
  soloModeDefault?: boolean | null;
  soloModeOnly?: boolean | null;
}

export function defaultDealMode(template: SoloFlags): DealModeChoice {
  return template.soloModeOnly || template.soloModeDefault || template.soloModeSupported
    ? "SOLO"
    : "NEGOTIATION";
}
