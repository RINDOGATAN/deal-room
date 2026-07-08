// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

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
// Rate Limiting — DB-backed fixed-bucket counter
// ────────────────────────────────────────────────────────────
//
// Each call atomically increments a per-window counter via
// upsert. Concurrent requests serialize on the row's lock; the
// limit check happens against the *post-increment* value so
// races are impossible. Counters are durable across cold-starts
// and shared between Vercel instances. Trade-off: fixed-bucket
// (vs sliding) — at boundary you can theoretically burst into
// the next window. For our limits (5–300/week, 100–1000/hour)
// that's acceptable.

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

/** Pure: rounds `now` down to the start of its window. */
export function computeBucket(
  now: number,
  windowMs: number,
): { windowStart: number; expiresAt: Date } {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return { windowStart, expiresAt: new Date(windowStart + windowMs) };
}

async function claimSlot(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const { windowStart, expiresAt } = computeBucket(now, windowMs);
  const fullKey = `${key}:${windowStart}`;

  const result = await prisma.rateLimitCounter.upsert({
    where: { key: fullKey },
    create: { key: fullKey, count: 1, expiresAt },
    update: { count: { increment: 1 } },
  });

  if (result.count > limit) {
    const retryAfter = Math.ceil((expiresAt.getTime() - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }
  return { allowed: true, remaining: Math.max(0, limit - result.count) };
}

/**
 * Check A2A-specific rate limits.
 * Standard tier: 5 invocations per skill per week per customer.
 * Premium tier (premiumA2A flag): 300 total invocations per week per customer.
 */
export async function checkA2aRateLimit(
  customerId: string,
  contractType: string,
  isPremiumA2a: boolean,
): Promise<RateLimitResult> {
  const weekMs = 7 * 24 * 3600_000;
  if (isPremiumA2a) {
    return claimSlot(`${customerId}:a2a:premium`, 300, weekMs);
  }
  return claimSlot(`${customerId}:a2a:${contractType}`, 5, weekMs);
}

/**
 * Check rate limit for a customer on a specific endpoint group.
 * Returns whether the request is allowed and remaining quota.
 */
export async function checkRateLimit(
  customerId: string,
  group: "negotiate" | "default",
): Promise<RateLimitResult> {
  const limit = group === "negotiate" ? 100 : 1000;
  return claimSlot(`${customerId}:${group}`, limit, 3600_000);
}

/**
 * Per-(customer, expert) daily cap on Experts-API contact requests.
 * Without this, a single customer can spam an expert by spreading
 * requests across different contract types or via repeat calls — the
 * existing 409 dedup only blocks IDENTICAL pending requests.
 */
export async function checkExpertContactRateLimit(
  customerId: string,
  expertId: string,
): Promise<RateLimitResult> {
  return claimSlot(`${customerId}:expert-contact:${expertId}`, 2, 24 * 3600_000);
}
