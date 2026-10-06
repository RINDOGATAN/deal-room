// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { ContractData } from "./generator";

/**
 * The agent-formation notice every renderer prints at the top of the
 * document: the UETA / E-SIGN statement and, when an attorney attested the
 * provisions, the attestation. Empty unless both sides negotiated through
 * agents (`agentAttestationFor`).
 */
export function agentNoticeParagraphs(data: ContractData): string[] {
  const a = data.agentAttestation;
  if (!a) return [];
  return [a.uetaPreamble, a.attestationFooter].filter((t) => t && t.trim());
}
