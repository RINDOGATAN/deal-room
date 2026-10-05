// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Party details for a contract made in one call (POST
 * /api/v1/agent/contracts): the caller's own side and, optionally, the
 * other side. Same shape as the signing details a person enters on the
 * sign page, so the document generator reads both the same way.
 *
 * The caller's side is stored as the initiator's `signingDetails`; the
 * other side, which a SOLO deal has no party row for, as the deal's
 * `soloCounterparty`.
 */

import { z } from "zod";

export const partyDetailsSchema = z.object({
  legalName: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).optional(),
  taxId: z.string().trim().max(100).optional(),
  signatoryName: z.string().trim().max(200).optional(),
  signatoryTitle: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(320).optional(),
});

export type PartyDetails = z.infer<typeof partyDetailsSchema>;

/** The stored JSON as party details, or null when absent or malformed. */
export function readSoloCounterparty(value: unknown): PartyDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const parsed = partyDetailsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Only the fields that carry a value (no empty strings in stored JSON). */
export function compactPartyDetails(details: PartyDetails): PartyDetails {
  return Object.fromEntries(
    Object.entries(details).filter(([, v]) => typeof v === "string" && v.trim() !== ""),
  ) as PartyDetails;
}
