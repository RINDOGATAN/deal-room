// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * tRPC reviewInterest.record: accepts the four allowed events with the
 * allowed values only, stores the event, the two answers and the language
 * (no user, deal, IP or user agent), and is rate-limited per client IP like
 * the other anonymous writes. Driven through the real fetch adapter.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const counters = vi.hoisted(() => new Map<string, number>());
const rows = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock("@/lib/prisma", () => {
  const p = {
    rateLimitCounter: {
      upsert: async ({ where }: { where: { key: string } }) => {
        const count = (counters.get(where.key) ?? 0) + 1;
        counters.set(where.key, count);
        return { key: where.key, count };
      },
    },
    reviewInterestEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        rows.push(data);
        return data;
      },
    },
  };
  return { prisma: p, default: p };
});
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ decode: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createInnerTRPCContext, createTRPCRouter } from "@/server/trpc";
import { reviewInterestRouter } from "@/server/routers/reviewInterest";
import { retryAfterMeta } from "@/server/trpc-response-meta";
import { PUBLIC_LIMITS } from "@/server/middleware/public-rate-limit";
import { tally } from "../../../scripts/count-review-interest.mjs";

const router = createTRPCRouter({ reviewInterest: reviewInterestRouter });

async function record(body: unknown, ip = "203.0.113.7") {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request("http://localhost/api/trpc/reviewInterest.record", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 test" },
      body: JSON.stringify({ json: body }),
    }),
    router,
    createContext: () =>
      createInnerTRPCContext({
        session: { user: { id: "user-1", email: "a@example.com" }, expires: "2099-01-01" } as never,
        adminSession: null,
        supervisorSession: null,
        getCookie: () => undefined,
        clientIp: ip,
      }),
    responseMeta: ({ errors }) => retryAfterMeta(errors),
  });
}

beforeEach(() => {
  counters.clear();
  rows.length = 0;
});

describe("reviewInterest.record", () => {
  it("stores the four allowed events, five columns only", async () => {
    const ok = [
      { event: "shown", locale: "en" },
      { event: "clicked", locale: "es" },
      { event: "answered", locale: "en", jurisdiction: "uk", speed: "two_hours" },
      { event: "california_link", locale: "en", jurisdiction: "california", speed: "this_week" },
    ];
    for (const body of ok) expect((await record(body)).status, JSON.stringify(body)).toBe(200);
    expect(rows).toEqual([
      { event: "shown", jurisdiction: null, speed: null, locale: "en" },
      { event: "clicked", jurisdiction: null, speed: null, locale: "es" },
      { event: "answered", jurisdiction: "uk", speed: "two_hours", locale: "en" },
      { event: "california_link", jurisdiction: "california", speed: "this_week", locale: "en" },
    ]);
    // Nothing from the session, the address or the browser reaches a row.
    const stored = JSON.stringify(rows);
    for (const leak of ["user-1", "a@example.com", "203.0.113.7", "Mozilla"]) expect(stored).not.toContain(leak);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(["event", "jurisdiction", "locale", "speed"]);
  });

  it("rejects anything beyond the allowed fields and values", async () => {
    const bad = [
      {},
      { event: "deleted", locale: "en" },
      { event: "shown", locale: "fr" },
      { event: "shown" },
      { event: "shown", locale: "en", dealId: "deal-1" },
      { event: "shown", locale: "en", userId: "user-1" },
      { event: "clicked", locale: "en", jurisdiction: "eu" },
      { event: "answered", locale: "en", jurisdiction: "mars", speed: "same_day" },
      { event: "answered", locale: "en", jurisdiction: "eu", speed: "next_year" },
      { event: "answered", locale: "en", jurisdiction: "eu" },
      { event: "answered", locale: "en", jurisdiction: "eu", speed: "same_day", email: "a@example.com" },
      { event: "california_link", locale: "en", jurisdiction: "eu", speed: "same_day" },
      { event: "shown", locale: "en", ip: "203.0.113.7", userAgent: "x" },
    ];
    for (const body of bad) expect((await record(body)).status, JSON.stringify(body)).toBe(400);
    expect(rows).toHaveLength(0);
  });

  it("is limited per client IP and answers 429 with Retry-After", async () => {
    const { limit } = PUBLIC_LIMITS["review-interest"];
    for (let i = 0; i < limit; i++) expect((await record({ event: "shown", locale: "en" })).status).toBe(200);
    const limited = await record({ event: "shown", locale: "en" });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    expect(rows).toHaveLength(limit);
    // Another address has its own bucket.
    expect((await record({ event: "shown", locale: "en" }, "198.51.100.2")).status).toBe(200);
  });
});

describe("operator report", () => {
  it("counts by event, jurisdiction and speed from grouped rows", () => {
    const report: Record<string, Record<string, Record<string, number> | number>> = tally([
      { event: "shown", jurisdiction: null, speed: null, locale: "en", _count: { _all: 10 } },
      { event: "shown", jurisdiction: null, speed: null, locale: "es", _count: { _all: 4 } },
      { event: "clicked", jurisdiction: null, speed: null, locale: "en", _count: { _all: 3 } },
      { event: "answered", jurisdiction: "california", speed: "same_day", locale: "en", _count: { _all: 2 } },
      { event: "answered", jurisdiction: "eu", speed: "this_week", locale: "es", _count: { _all: 1 } },
      { event: "california_link", jurisdiction: "california", speed: "same_day", locale: "en", _count: { _all: 1 } },
    ]);
    expect(report.by_event).toEqual({ shown: 14, clicked: 3, answered: 3, california_link: 1 });
    expect(report.by_locale.es).toEqual({ shown: 4, clicked: 0, answered: 1, california_link: 0 });
    expect(report.answered_by_jurisdiction).toEqual({ california: 2, us_other: 0, eu: 1, uk: 0, elsewhere: 0 });
    expect(report.answered_by_speed).toEqual({ two_hours: 0, same_day: 2, this_week: 1 });
    expect(report.answered_by_jurisdiction_and_speed.california).toEqual({ two_hours: 0, same_day: 2, this_week: 0 });
  });
});
