// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API keys: one generator for both paths that issue them (the
 * platform administrator at /admin/customers and the person under
 * Settings, API keys). The raw key is `drk_` + 64 hex characters; only its
 * SHA-256 hash and a 12-character prefix are stored, and the raw key is
 * returned once, at creation.
 */

import { randomBytes } from "crypto";
import { sha256 } from "@/lib/crypto";

export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = `drk_${randomBytes(32).toString("hex")}`;
  return {
    rawKey,
    keyHash: sha256(rawKey),
    keyPrefix: rawKey.slice(0, 12), // "drk_" + 8 hex chars
  };
}

/** The columns of a key that may leave the server. Never the hash. */
export const API_KEY_PUBLIC_SELECT = {
  id: true,
  name: true,
  keyPrefix: true,
  scopes: true,
  isActive: true,
  lastUsedAt: true,
  expiresAt: true,
  createdAt: true,
} as const;

/** An active key: not revoked and not expired. */
export function activeKeyWhere(customerId: string, now = new Date()) {
  return {
    customerId,
    isActive: true,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}
