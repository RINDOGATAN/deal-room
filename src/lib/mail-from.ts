// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { brand } from "@/config/brand";

const FALLBACK_ADDRESS = "noreply@todo.law";

/**
 * Product name as it appears in outgoing e-mail: title case ("Dealroom"),
 * never the capitalised UI wordmark. White-label builds override it through
 * NEXT_PUBLIC_BRAND_NAME (see config/brands/todo.ts).
 */
export const mailProductName = brand.name;

/**
 * The only place the From header is built. Every send uses it, so the display
 * name is the same on every mail across the TODO.LAW suite:
 * "<Product> by <Company> <address>". The address comes from EMAIL_FROM; any
 * display name that variable already carries is discarded, so the environment
 * cannot change what recipients see as the sender.
 */
export function mailFrom(raw: string | undefined = process.env.EMAIL_FROM): string {
  const value = raw?.trim() || FALLBACK_ADDRESS;
  // Non-greedy so a malformed value with nested angle brackets cannot
  // capture an inner "<" and produce a header the provider rejects.
  const address = value.includes("<") ? value.match(/<(.+?)>/)?.[1]?.trim() || FALLBACK_ADDRESS : value;
  return `${mailProductName} by ${brand.company} <${address}>`;
}

/** Subject of the sign-in mail; `door` names an administrator or supervisor door. */
export function signInSubject(door?: string): string {
  return door ? `Sign in to ${mailProductName} (${door})` : `Sign in to ${mailProductName}`;
}
