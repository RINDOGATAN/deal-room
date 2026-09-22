// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkHealth, type HealthProbe } from "@/server/health";

const LAST = "20260916120000_user_pilot_started_at";

function probe(over: Partial<HealthProbe> = {}): HealthProbe {
  return {
    ping: async () => 1,
    migrations: async () => ({ lastApplied: LAST, failed: 0 }),
    ...over,
  };
}

describe("checkHealth", () => {
  it("healthy: database answers and migrations match", async () => {
    const v = await checkHealth(probe(), LAST);
    expect(v).toMatchObject({ ok: true, reason: null });
  });

  it("database: a query that fails", async () => {
    const v = await checkHealth(probe({ ping: async () => Promise.reject(new Error("ECONNREFUSED")) }), LAST);
    expect(v).toEqual({ ok: false, reason: "database", databaseLatencyMs: null });
  });

  it("database: a query slower than the limit", async () => {
    const slow = () => new Promise((r) => setTimeout(r, 200));
    const v = await checkHealth(probe({ ping: slow }), LAST, 20);
    expect(v.reason).toBe("database");
  });

  it("migrations: the database is behind the build", async () => {
    const v = await checkHealth(
      probe({ migrations: async () => ({ lastApplied: "20260911120000_clause_retirement", failed: 0 }) }),
      LAST,
    );
    expect(v).toMatchObject({ ok: false, reason: "migrations" });
  });

  it("migrations: a failed migration, no migrations table, or nothing recorded in the build", async () => {
    expect((await checkHealth(probe({ migrations: async () => ({ lastApplied: LAST, failed: 1 }) }), LAST)).reason).toBe(
      "migrations",
    );
    expect(
      (await checkHealth(probe({ migrations: async () => Promise.reject(new Error("relation does not exist")) }), LAST))
        .reason,
    ).toBe("migrations");
    expect((await checkHealth(probe(), "")).reason).toBe("migrations");
  });

  it("the cause is handed to the log, never returned", async () => {
    const log = vi.fn();
    const v = await checkHealth(probe({ ping: async () => Promise.reject(new Error("secret host x")) }), LAST, 2000, log);
    expect(log).toHaveBeenCalledWith("database", expect.any(Error));
    expect(JSON.stringify(v)).not.toContain("secret");
  });
});

describe("the build records its last migration", () => {
  it("next.config.ts inlines the last folder of prisma/migrations", () => {
    const root = join(__dirname, "..", "..", "..");
    const config = readFileSync(join(root, "next.config.ts"), "utf8");
    expect(config).toContain("DEALROOM_BUILD_MIGRATION");
    const last = readdirSync(join(root, "prisma", "migrations"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .at(-1);
    expect(last).toBeTruthy();
  });
});

// The route itself: status codes and body, with the database mocked.
const db = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { $queryRaw: db.queryRaw } }));
vi.mock("@/server/middleware/public-rate-limit", () => ({
  checkPublicRateLimit: async () => ({ allowed: true }),
  clientIp: () => "127.0.0.1",
  tooManyRequests: () => new Response(null, { status: 429 }),
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetModules();
    db.queryRaw.mockReset();
    vi.stubEnv("DEALROOM_BUILD_MIGRATION", LAST);
    vi.stubEnv("DEALROOM_BUILD_VERSION", "0.1.34");
    vi.stubEnv("DEALROOM_BUILD_COMMIT", "abc1234");
  });

  async function get() {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET(new Request("http://localhost/api/health"));
    return { status: res.status, body: await res.json() };
  }

  it("200 with commit and version when all is well", async () => {
    db.queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]).mockResolvedValueOnce([{ last_applied: LAST, failed: BigInt(0) }]);
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, reason: null, version: "0.1.34", commit: "abc1234" });
  });

  it("503 'migrations' when the database is behind, with no detail", async () => {
    db.queryRaw.mockResolvedValueOnce([1]).mockResolvedValueOnce([{ last_applied: "20200101000000_old", failed: BigInt(0) }]);
    const { status, body } = await get();
    expect(status).toBe(503);
    expect(body.reason).toBe("migrations");
    expect(JSON.stringify(body)).not.toContain("20200101000000_old");
  });

  it("503 'database' when the database does not answer", async () => {
    db.queryRaw.mockRejectedValueOnce(new Error("Can't reach database server at db.internal:5432"));
    const { status, body } = await get();
    expect(status).toBe(503);
    expect(body.reason).toBe("database");
    expect(JSON.stringify(body)).not.toContain("db.internal");
  });
});
