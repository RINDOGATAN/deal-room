// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Reference ids for failures a person sees, and the rule for which error
 * text may reach the screen.
 *
 * A reference is short enough to read out and quote in a report, and the
 * same id is written to the log next to the error. When Next.js gives a
 * server-side failure a `digest`, the reference is built from it, so it
 * matches the line the server already logged.
 */

import { formatUserError } from "@/lib/format-error";

const PREFIX = "DR-";

function randomId(): string {
  const bytes = new Uint8Array(5);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function errorReference(digest?: string | null): string {
  const clean = digest?.replace(/[^A-Za-z0-9]/g, "");
  return `${PREFIX}${clean ? clean.slice(0, 12) : randomId()}`.toUpperCase();
}

/**
 * Error classes raised by a programming mistake. Their message describes the
 * code, not what the person can do, so it never reaches the screen.
 */
const PROGRAMMING_ERRORS = new Set(["TypeError", "ReferenceError", "SyntaxError", "RangeError", "EvalError", "URIError"]);

export function isProgrammingError(err: unknown): boolean {
  return err instanceof Error && PROGRAMMING_ERRORS.has(err.name);
}

/**
 * The text an error page may show, or null for the generic sentence. Only a
 * message the server wrote for a person (a tRPC error, already sanitised by
 * the server's error formatter) is shown; anything else stays in the log.
 */
export function userSafeErrorMessage(err: unknown): string | null {
  if (!(err instanceof Error) || err.name !== "TRPCClientError") return null;
  const msg = formatUserError(err, "");
  if (!msg || /\n\s+at\s/.test(msg)) return null;
  return msg;
}
