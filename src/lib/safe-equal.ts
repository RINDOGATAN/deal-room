// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Constant-time string comparison for secrets (shared keys, signatures).
 *
 * Both sides are hashed to a fixed 32 bytes before `timingSafeEqual`, so the
 * time taken reveals neither where the strings first differ nor the length of
 * the candidate. A plain `===` (or a length check followed by a byte compare)
 * reveals both. Same helper as AI Sentinel's import key check.
 *
 * Server-only (node:crypto). An empty or missing value never matches, so an
 * unset secret cannot be satisfied by an empty input.
 */
import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function safeEqual(
  candidate: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!candidate || !expected) return false;
  return timingSafeEqual(digest(candidate), digest(expected));
}
