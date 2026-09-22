// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * What a person reads when a procedure fails on our side.
 *
 * Every INTERNAL_SERVER_ERROR gets a reference id, and the failure is
 * logged under it (in every environment: an unlogged failure cannot be
 * traced from a report). The message the person sees:
 *   - a database hiccup: the "reconnecting, try again" sentence;
 *   - a programming error, an ORM error, or no usable message: a sentence
 *     saying what to do, with the reference to quote;
 *   - a message the code wrote on purpose: kept as written.
 */

import type { TRPCError } from "@trpc/server";
import { createLogger } from "@/lib/logger";
import { formatUserError, isTransientDbError, TRANSIENT_MESSAGE } from "@/lib/format-error";
import { errorReference, isProgrammingError } from "@/lib/error-reference";

const logger = createLogger("trpc");

const GENERIC_MESSAGES = new Set(["", "Internal server error", "INTERNAL_SERVER_ERROR"]);

export function internalErrorMessage(reference: string): string {
  return `Something went wrong on our side. Please try again in a moment; if it keeps happening, report it with reference ${reference}.`;
}

export function presentInternalError(
  error: TRPCError,
  path: string | undefined,
): { message: string; reference: string } {
  const cause = error.cause ?? error;
  const reference = errorReference();

  logger.error("procedure failed", {
    reference,
    path: path ?? "<no-path>",
    name: cause instanceof Error ? cause.name : typeof cause,
    err: cause instanceof Error ? cause.message : String(cause),
  });

  if (isTransientDbError(cause)) return { message: TRANSIENT_MESSAGE, reference };
  if (isProgrammingError(cause)) return { message: internalErrorMessage(reference), reference };

  const written = formatUserError(cause, "");
  if (GENERIC_MESSAGES.has(written.trim())) {
    return { message: internalErrorMessage(reference), reference };
  }
  return { message: written, reference };
}
