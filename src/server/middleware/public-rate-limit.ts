// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Rate limits for public and session routes that the agent-API limits in
 * `apiKeyAuth.ts` do not cover: sign-in attempts, magic-link e-mails, the
 * skill download/install path and the health check.
 *
 * Reuses the same DB-backed fixed-bucket counter (`claimSlot`), so limits
 * hold across Vercel instances and cold starts.
 *
 * Fail-open: if the counter itself cannot be written (database down or a
 * transient Neon error) the request is allowed and the failure is logged.
 * The limiter is abuse protection, and it must not turn a database blip
 * into a sign-in outage, nor make /api/health report something other than
 * the database probe it exists to report.
 */

import { NextResponse } from "next/server";
import { claimSlot, type RateLimitResult } from "./apiKeyAuth";
import { createLogger } from "@/lib/logger";

const logger = createLogger("public-rate-limit");

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export type PublicLimitName =
  | "sign-in"
  | "magic-link"
  | "skill-install"
  | "skill-download"
  | "health";

/** Per-identity limits. Identity is the client IP unless noted. */
export const PUBLIC_LIMITS: Record<
  PublicLimitName,
  { limit: number; windowMs: number }
> = {
  // Credentials callbacks (local, invite-code, tester, e2e) and OAuth starts.
  "sign-in": { limit: 20, windowMs: 15 * MINUTE },
  // Each request sends an e-mail: keep it tight.
  "magic-link": { limit: 5, windowMs: HOUR },
  // Keyed by user id: a .skill upload is parsed and written to the DB.
  "skill-install": { limit: 10, windowMs: HOUR },
  // Keyed by client IP (the token path carries no session).
  "skill-download": { limit: 30, windowMs: HOUR },
  // Generous: uptime monitors poll once a minute or so.
  health: { limit: 60, windowMs: MINUTE },
};

type HeaderSource = { get(name: string): string | null };

/**
 * First hop of x-forwarded-for (set by Vercel and by the suite's reverse
 * proxy), then x-real-ip. Returns "unknown" when neither is present, so
 * header-less clients share one bucket rather than bypassing the limit.
 */
export function clientIp(headers: HeaderSource): string {
  const xff = headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip")?.trim() || "unknown";
}

export async function checkPublicRateLimit(
  name: PublicLimitName,
  identity: string,
): Promise<RateLimitResult> {
  const { limit, windowMs } = PUBLIC_LIMITS[name];
  try {
    return await claimSlot(`public:${name}:${identity}`, limit, windowMs);
  } catch (error) {
    logger.error("rate-limit counter unavailable; allowing request", {
      limit: name,
      err: String(error),
    });
    return { allowed: true, remaining: limit };
  }
}

export function tooManyRequests(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please wait and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter ?? 60),
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Which limit, if any, applies to a NextAuth request. NextAuth v4 routes
 * sign-in through POST `<base>/signin/<provider>` (the e-mail provider sends
 * the magic link here) and POST `<base>/callback/<provider>` (credentials
 * providers check the submitted credentials here). GET requests (session,
 * CSRF, the magic-link click itself) are not limited.
 */
export function classifyAuthRequest(
  method: string,
  pathname: string,
): PublicLimitName | null {
  if (method.toUpperCase() !== "POST") return null;
  const segments = pathname.split("/").filter(Boolean);
  const action = segments[segments.length - 2];
  const provider = segments[segments.length - 1];
  if (action === "signin" && provider === "email") return "magic-link";
  if (action === "signin" || action === "callback") return "sign-in";
  return null;
}

type RouteHandler = (req: Request, ctx: unknown) => Promise<Response> | Response;

/**
 * Wrap a NextAuth route handler so sign-in and magic-link POSTs are limited
 * per client IP before NextAuth sees them. `scope` separates the user,
 * admin and supervisor sign-in surfaces into distinct buckets.
 */
export function withAuthRateLimit(
  scope: string,
  handler: RouteHandler,
): RouteHandler {
  return async (req, ctx) => {
    const name = classifyAuthRequest(req.method, new URL(req.url).pathname);
    if (name) {
      const result = await checkPublicRateLimit(
        name,
        `${scope}:${clientIp(req.headers)}`,
      );
      if (!result.allowed) return tooManyRequests(result);
    }
    return handler(req, ctx);
  };
}
