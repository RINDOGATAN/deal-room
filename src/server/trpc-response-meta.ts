// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { TRPCError } from "@trpc/server";
import { RateLimitedError } from "@/server/middleware/public-rate-limit";

/**
 * tRPC `responseMeta`: when a rate-limited procedure refused the call, the
 * HTTP response carries Retry-After (seconds), like the plain API routes.
 * tRPC already maps TOO_MANY_REQUESTS to HTTP 429.
 */
export function retryAfterMeta(
  errors: readonly TRPCError[],
): { headers?: Record<string, string> } {
  let retryAfter = 0;
  for (const error of errors) {
    if (error.cause instanceof RateLimitedError) {
      retryAfter = Math.max(retryAfter, error.cause.retryAfter);
    }
  }
  if (!retryAfter) return {};
  return { headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } };
}
