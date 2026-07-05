/**
 * Idempotency-Key support for agent API POST endpoints.
 *
 * Clients send `Idempotency-Key: <opaque-token>` with their request.
 * On the first request we run the handler and cache the (status, body)
 * tuple keyed on (customerId, key). Subsequent requests within the
 * TTL window with the same key replay that cached response instead of
 * re-running the handler — so an agent retrying after a transient
 * timeout doesn't accidentally create a second deal/playbook/dispute.
 *
 * Mirrors Stripe's contract:
 *   - Only successful (2xx) responses are cached.
 *   - 4xx/5xx responses run the handler fresh on retry.
 *   - Replays carry the `Idempotent-Replay: true` response header.
 *   - Keys expire after IDEMPOTENCY_TTL_MS.
 *
 * Trade-off chosen for simplicity: we cache *after* the handler runs,
 * not before. A genuinely concurrent retry (same key, both requests
 * in flight) can run the handler twice in worst case. This is rare in
 * practice — agents retrying on timeout typically wait seconds, not
 * concurrent. The unique-constraint insert serializes the cache step,
 * so neither write corrupts the other; the second request just
 * persists its own (identical) result, which is fine.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const logger = createLogger("idempotency");

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const KEY_MAX_LEN = 200;
const KEY_REGEX = /^[A-Za-z0-9_-]+$/;

export type IdempotencyKeyValidation =
  | { valid: true; key: string }
  | { valid: false; reason: "TOO_LONG" | "INVALID_CHARS" };

export function validateIdempotencyKey(raw: string): IdempotencyKeyValidation {
  if (raw.length > KEY_MAX_LEN) return { valid: false, reason: "TOO_LONG" };
  if (!KEY_REGEX.test(raw)) return { valid: false, reason: "INVALID_CHARS" };
  return { valid: true, key: raw };
}

/**
 * Wrap a route handler so its result is cached against the
 * client-supplied Idempotency-Key header. If no header is present,
 * the handler runs as normal (no caching).
 */
export async function withIdempotency(
  req: NextRequest,
  customerId: string,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const rawKey = req.headers.get("Idempotency-Key");
  if (!rawKey) return handler();

  const validation = validateIdempotencyKey(rawKey);
  if (!validation.valid) {
    return NextResponse.json(
      {
        error:
          validation.reason === "TOO_LONG"
            ? `Idempotency-Key must be ≤${KEY_MAX_LEN} characters.`
            : "Idempotency-Key must contain only letters, digits, underscores, or dashes.",
      },
      { status: 400 },
    );
  }
  const key = validation.key;

  // Replay cache hit?
  const existing = await prisma.idempotencyRecord.findUnique({
    where: { customerId_key: { customerId, key } },
  });
  if (existing) {
    if (existing.expiresAt > new Date()) {
      return new NextResponse(existing.responseBody, {
        status: existing.status,
        headers: {
          "Content-Type": "application/json",
          "Idempotent-Replay": "true",
        },
      });
    }
    // Stale — clean up so the new run can cache fresh.
    await prisma.idempotencyRecord
      .delete({ where: { customerId_key: { customerId, key } } })
      .catch(() => undefined);
  }

  const response = await handler();

  // Only cache successful responses. 4xx/5xx are retry-eligible.
  if (response.status >= 200 && response.status < 300) {
    const body = await response.clone().text();
    try {
      await prisma.idempotencyRecord.create({
        data: {
          customerId,
          key,
          method: req.method,
          path: req.nextUrl.pathname,
          status: response.status,
          responseBody: body,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
        },
      });
    } catch (err) {
      // Concurrent retry won the race and cached first — that's fine,
      // both responses are identical for a deterministic handler.
      // Other errors: log but don't fail the user-visible request.
      const isUnique =
        err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002";
      if (!isUnique) {
        logger.error("Failed to cache idempotency record", { err: String(err) });
      }
    }
  }

  return response;
}
