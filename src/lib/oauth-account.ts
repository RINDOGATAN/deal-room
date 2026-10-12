// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The provider tokens an OAuth sign-in returns, which Dealroom does not keep.
 * Sessions are JWTs and no code reads these columns, so storing them would
 * only add data to protect.
 */
export const OAUTH_TOKEN_FIELDS = ["access_token", "refresh_token", "id_token"] as const;

/** The account link without the provider's tokens; every other field kept. */
export function withoutOAuthTokens<T extends object>(account: T): T {
  const copy = { ...account } as Record<string, unknown>;
  for (const field of OAUTH_TOKEN_FIELDS) delete copy[field];
  return copy as T;
}
