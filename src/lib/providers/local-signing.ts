// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Local Signing Provider — "type-to-sign"
 *
 * Built-in signing provider that ships with the AGPL core.
 * Uses typed signatures (no cryptographic e-signatures).
 * The ISigningProvider interface is extensible if a qualified
 * e-signature provider is added in the future.
 */

import type {
  ISigningProvider,
  SignatureRequest,
  SignatureEvent,
  SigningResult,
} from "./types";

export class LocalSigningProvider implements ISigningProvider {
  readonly id = "type-to-sign";
  readonly displayName = "Type-to-Sign";
  readonly qualifiedSignatures = false;

  async createRequest(request: SignatureRequest): Promise<SigningResult> {
    return {
      externalId: request.externalId || `sign_${Date.now()}`,
      status: "PENDING",
    };
  }

  async recordSignature(
    externalId: string,
    _event: SignatureEvent
  ): Promise<SigningResult> {
    // In the local provider, signature recording is handled
    // directly by the signing router via Prisma. This method
    // is a no-op — the result comes from the database state.
    return {
      externalId,
      status: "PARTIALLY_SIGNED",
    };
  }

  async getStatus(externalId: string): Promise<SigningResult> {
    return {
      externalId,
      status: "PENDING",
    };
  }
}
