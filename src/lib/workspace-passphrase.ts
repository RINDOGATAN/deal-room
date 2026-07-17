// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { timingSafeEqual } from "node:crypto";

/**
 * Verify a workspace passphrase for the sovereign/self-hosted local login.
 *
 * Timing-safe: byte-length is checked first (crypto.timingSafeEqual throws
 * on unequal-length buffers), then the comparison itself leaks no timing
 * information about where the mismatch occurs. The length check does reveal
 * the passphrase length in theory — the standard, accepted trade-off.
 *
 * An empty `required` means no gate is configured: everything passes, so an
 * update to a deployment that never set WORKSPACE_PASSPHRASE cannot lock
 * anyone out.
 */
export function verifyWorkspacePassphrase(
  input: string | null | undefined,
  required: string
): boolean {
  if (!required) return true;
  if (!input) return false;
  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(required, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
