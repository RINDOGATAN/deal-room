/**
 * API Key Authentication Middleware
 *
 * Authenticates requests using Bearer tokens with the `drk_` prefix.
 * API keys are hashed with SHA-256 and stored in the database.
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { sha256 } from "@/lib/crypto";
import type { Customer } from "@prisma/client";

export interface ApiKeyAuth {
  customer: Customer;
  apiKey: { id: string; name: string; scopes: string[] };
  scopes: string[];
}

/**
 * Authenticate a request using an API key from the Authorization header.
 * Returns null if authentication fails.
 */
export async function authenticateApiKey(
  req: NextRequest
): Promise<ApiKeyAuth | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer drk_")) return null;

  const rawKey = auth.slice(7); // Remove "Bearer " prefix
  const keyHash = sha256(rawKey);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { customer: true },
  });

  if (!apiKey?.isActive) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update lastUsedAt (fire-and-forget)
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    customer: apiKey.customer,
    apiKey: { id: apiKey.id, name: apiKey.name, scopes: apiKey.scopes },
    scopes: apiKey.scopes,
  };
}

/**
 * Check if the authenticated API key has the required scope.
 * Throws an error object with status 403 if the scope is missing.
 */
export function requireScope(
  auth: ApiKeyAuth,
  scope: string
): void {
  if (!auth.scopes.includes(scope)) {
    throw new ApiScopeError(scope);
  }
}

export class ApiScopeError extends Error {
  public status = 403;
  constructor(scope: string) {
    super(`API key missing required scope: ${scope}`);
    this.name = "ApiScopeError";
  }
}

// ────────────────────────────────────────────────────────────
// Rate Limiting (in-memory sliding window)
// ────────────────────────────────────────────────────────────

interface RateLimitWindow {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitWindow>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of rateLimitStore) {
    window.timestamps = window.timestamps.filter((t) => now - t < 3600_000);
    if (window.timestamps.length === 0) rateLimitStore.delete(key);
  }
}, 300_000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

/**
 * Check rate limit for a customer on a specific endpoint group.
 * Returns whether the request is allowed and remaining quota.
 */
export function checkRateLimit(
  customerId: string,
  group: "negotiate" | "default",
): RateLimitResult {
  const limit = group === "negotiate" ? 100 : 1000;
  const windowMs = 3600_000; // 1 hour
  const now = Date.now();
  const key = `${customerId}:${group}`;

  let window = rateLimitStore.get(key);
  if (!window) {
    window = { timestamps: [] };
    rateLimitStore.set(key, window);
  }

  // Remove timestamps outside the window
  window.timestamps = window.timestamps.filter((t) => now - t < windowMs);

  if (window.timestamps.length >= limit) {
    const oldestInWindow = window.timestamps[0];
    const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  window.timestamps.push(now);
  return { allowed: true, remaining: limit - window.timestamps.length };
}
