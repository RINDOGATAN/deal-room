// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory stand-in for the rate_limit_counters table: same upsert
// semantics (create at 1, increment on conflict).
const counters = new Map<string, number>();
let failCounter = false;
const upsert = vi.fn(async ({ where }: { where: { key: string } }) => {
  if (failCounter) throw new Error("connection refused");
  const count = (counters.get(where.key) ?? 0) + 1;
  counters.set(where.key, count);
  return { key: where.key, count };
});

vi.mock("@/lib/prisma", () => {
  const p = { rateLimitCounter: { upsert: (a: never) => upsert(a) } };
  return { prisma: p, default: p };
});

import {
  PUBLIC_LIMITS,
  checkPublicRateLimit,
  classifyAuthRequest,
  clientIp,
  withAuthRateLimit,
} from "../public-rate-limit";

beforeEach(() => {
  counters.clear();
  failCounter = false;
  upsert.mockClear();
});

describe("classifyAuthRequest", () => {
  it("treats POST signin/email as a magic-link request", () => {
    expect(classifyAuthRequest("POST", "/api/auth/signin/email")).toBe(
      "magic-link",
    );
    expect(classifyAuthRequest("POST", "/api/auth/admin/signin/email")).toBe(
      "magic-link",
    );
  });

  it("treats credentials callbacks and OAuth starts as sign-in", () => {
    for (const p of [
      "/api/auth/callback/local",
      "/api/auth/callback/invite-code",
      "/api/auth/callback/tester",
      "/api/auth/callback/e2e-credentials",
      "/api/auth/signin/google",
    ]) {
      expect(classifyAuthRequest("POST", p)).toBe("sign-in");
    }
  });

  it("does not limit GETs (session, csrf, the magic-link click)", () => {
    expect(classifyAuthRequest("GET", "/api/auth/session")).toBeNull();
    expect(classifyAuthRequest("GET", "/api/auth/callback/email")).toBeNull();
    expect(classifyAuthRequest("POST", "/api/auth/signout")).toBeNull();
  });
});

describe("clientIp", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("takes the first x-forwarded-for hop", () => {
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
  });
  it("falls back to x-real-ip, then a shared bucket", () => {
    expect(clientIp(h({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(h({}))).toBe("unknown");
  });
});

describe("checkPublicRateLimit", () => {
  it("allows up to the limit and refuses the next request", async () => {
    const { limit } = PUBLIC_LIMITS["magic-link"];
    for (let i = 0; i < limit; i++) {
      expect((await checkPublicRateLimit("magic-link", "1.2.3.4")).allowed).toBe(
        true,
      );
    }
    const over = await checkPublicRateLimit("magic-link", "1.2.3.4");
    expect(over.allowed).toBe(false);
    expect(over.retryAfter).toBeGreaterThan(0);
  });

  it("keeps identities and limit names in separate buckets", async () => {
    const { limit } = PUBLIC_LIMITS["magic-link"];
    for (let i = 0; i <= limit; i++) {
      await checkPublicRateLimit("magic-link", "1.2.3.4");
    }
    expect((await checkPublicRateLimit("magic-link", "5.6.7.8")).allowed).toBe(
      true,
    );
    expect((await checkPublicRateLimit("health", "1.2.3.4")).allowed).toBe(true);
  });

  it("fails open when the counter cannot be written", async () => {
    failCounter = true;
    const r = await checkPublicRateLimit("sign-in", "1.2.3.4");
    expect(r.allowed).toBe(true);
  });
});

describe("withAuthRateLimit", () => {
  const inner = vi.fn(async () => new Response("ok"));
  const wrapped = withAuthRateLimit("user", inner);
  const post = (path: string) =>
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.9" },
    });

  it("returns 429 with Retry-After once the magic-link limit is spent", async () => {
    const { limit } = PUBLIC_LIMITS["magic-link"];
    for (let i = 0; i < limit; i++) {
      expect((await wrapped(post("/api/auth/signin/email"), {})).status).toBe(
        200,
      );
    }
    const res = await wrapped(post("/api/auth/signin/email"), {});
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(inner).toHaveBeenCalledTimes(limit);
  });

  it("passes unlimited requests straight through without touching the counter", async () => {
    const res = await wrapped(
      new Request("http://localhost/api/auth/session"),
      {},
    );
    expect(res.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
  });
});
