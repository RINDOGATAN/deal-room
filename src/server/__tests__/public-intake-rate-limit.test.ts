// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * C6 (cycle 15): the unauthenticated intake and token look-ups are limited
 * per client IP and per minute on the shared database counter, and answer
 * 429 with Retry-After once the limit is spent:
 *   - tRPC feedback.submit (driven through the real fetch adapter and the
 *     route's responseMeta, so the HTTP status and header are real)
 *   - tRPC invitation.getByToken
 *   - GET /api/signing/firmas-bundle/[token]
 *   - POST /api/signing/firmas-callback
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory stand-in for the rate_limit_counters table (same upsert
// semantics as the real one: create at 1, increment on conflict).
const counters = vi.hoisted(() => new Map<string, number>());
const feedbackRows = vi.hoisted(() => [] as unknown[]);

vi.mock("@/lib/prisma", () => {
  const p = {
    rateLimitCounter: {
      upsert: async ({ where }: { where: { key: string } }) => {
        const count = (counters.get(where.key) ?? 0) + 1;
        counters.set(where.key, count);
        return { key: where.key, count };
      },
    },
    feedback: {
      create: async ({ data }: { data: unknown }) => {
        feedbackRows.push(data);
        return data;
      },
    },
    invitation: { findUnique: async () => null },
    signingRequest: { findFirst: async () => null },
  };
  return { prisma: p, default: p };
});
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ decode: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/email",() => ({ sendInvitationEmail: vi.fn() }));

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { NextRequest } from "next/server";
import { createInnerTRPCContext, createTRPCRouter } from "@/server/trpc";
import { feedbackRouter } from "@/server/routers/feedback";
import { invitationRouter } from "@/server/routers/invitation";
import { retryAfterMeta } from "@/server/trpc-response-meta";
import { PUBLIC_LIMITS } from "@/server/middleware/public-rate-limit";
import { GET as bundleGET } from "@/app/api/signing/firmas-bundle/[token]/route";
import { POST as callbackPOST } from "@/app/api/signing/firmas-callback/route";

const router = createTRPCRouter({ feedback: feedbackRouter, invitation: invitationRouter });

async function submitFeedback(ip: string) {
  const res = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request("http://localhost/api/trpc/feedback.submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: { message: "hello", page: "/deals" } }),
    }),
    router,
    createContext: () =>
      createInnerTRPCContext({
        session: null,
        adminSession: null,
        supervisorSession: null,
        getCookie: () => undefined,
        clientIp: ip,
      }),
    responseMeta: ({ errors }) => retryAfterMeta(errors),
  });
  return res;
}

beforeEach(() => {
  counters.clear();
  feedbackRows.length = 0;
});

describe("limits are per minute", () => {
  it("each new limit has a one-minute window", () => {
    for (const name of ["feedback", "invitation-lookup", "signing-bundle", "signing-callback"] as const) {
      expect(PUBLIC_LIMITS[name].windowMs).toBe(60_000);
    }
  });
});

describe("feedback.submit", () => {
  it("accepts up to the limit, then answers 429 with Retry-After and writes nothing more", async () => {
    const { limit } = PUBLIC_LIMITS.feedback;
    for (let i = 0; i < limit; i++) {
      expect((await submitFeedback("203.0.113.5")).status).toBe(200);
    }
    const refused = await submitFeedback("203.0.113.5");
    expect(refused.status).toBe(429);
    const retryAfter = Number(refused.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
    expect(feedbackRows).toHaveLength(limit);
  });

  it("keeps a separate bucket per client", async () => {
    const { limit } = PUBLIC_LIMITS.feedback;
    for (let i = 0; i <= limit; i++) await submitFeedback("203.0.113.5");
    expect((await submitFeedback("198.51.100.7")).status).toBe(200);
  });
});

describe("invitation.getByToken", () => {
  it("refuses with TOO_MANY_REQUESTS after the limit", async () => {
    const caller = router.createCaller(
      createInnerTRPCContext({
        session: null,
        adminSession: null,
        supervisorSession: null,
        getCookie: () => undefined,
        clientIp: "203.0.113.9",
      }),
    );
    const { limit } = PUBLIC_LIMITS["invitation-lookup"];
    for (let i = 0; i < limit; i++) {
      await expect(caller.invitation.getByToken({ token: `t${i}` })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
    await expect(caller.invitation.getByToken({ token: "next" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});

function req(url: string, init?: { method?: string; body?: string }) {
  return new NextRequest(url, {
    ...init,
    headers: { "x-forwarded-for": "192.0.2.44", "content-type": "application/json" },
  });
}

describe("Firmas signing routes", () => {
  it("bundle look-up answers 429 with Retry-After and CORS after the limit", async () => {
    const { limit } = PUBLIC_LIMITS["signing-bundle"];
    const ctx = { params: Promise.resolve({ token: "nope" }) };
    for (let i = 0; i < limit; i++) {
      expect((await bundleGET(req("http://localhost/api/signing/firmas-bundle/nope"), ctx)).status).toBe(404);
    }
    const refused = await bundleGET(req("http://localhost/api/signing/firmas-bundle/nope"), ctx);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(refused.headers.get("access-control-allow-origin")).toBeTruthy();
  });

  it("callback answers 429 with Retry-After after the limit", async () => {
    const { limit } = PUBLIC_LIMITS["signing-callback"];
    const post = () =>
      callbackPOST(req("http://localhost/api/signing/firmas-callback", { method: "POST", body: "{}" }));
    for (let i = 0; i < limit; i++) expect((await post()).status).toBe(400);
    const refused = await post();
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toMatch(/^\d+$/);
  });
});
