// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextResponse } from "next/server";
import { formatUserError, isTransientDbError } from "./format-error";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api");

/**
 * Sanitize an API route error into a JSON response.
 * Transient DB errors (Neon cold-start, connection issues) become 503 with a
 * friendly "reconnecting" message. Anything else becomes 500 with the caller's
 * fallback — never the raw error body.
 *
 * Logs the original error server-side for observability.
 */
export function apiError(
  error: unknown,
  fallback = "An unexpected error occurred. Please try again.",
): NextResponse {
  logger.error("API route error", { err: String(error) });
  const message = formatUserError(error, fallback);
  const status = isTransientDbError(error) ? 503 : 500;
  return NextResponse.json({ error: message }, { status });
}
