// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC
import { describe, it, expect, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ACTIVITY_LABELS,
  buildCounts,
  errorClass,
} from "../../../scripts/count-accounts.mjs";

const NOW = new Date("2026-09-20T12:00:00.000Z");
const SINCE = new Date("2026-08-21T12:00:00.000Z");

type CountFn = ReturnType<typeof vi.fn>;

/** A client exposing `count` and nothing else: any other call throws. */
function mockDb(result: (model: string, args: unknown) => unknown) {
  const model = (name: string) => ({
    count: vi.fn(async (args?: unknown) => result(name, args)),
  });
  return {
    user: model("user"),
    customer: model("customer"),
    dealRoom: model("dealRoom"),
    agentDealRoom: model("agentDealRoom"),
    agentDispute: model("agentDispute"),
  };
}

function allCalls(db: ReturnType<typeof mockDb>) {
  return Object.values(db).flatMap((m) => (m.count as CountFn).mock.calls);
}

describe("count-accounts", () => {
  it("returns the contract shape", async () => {
    const out = await buildCounts(mockDb(() => 7), NOW);
    expect(Object.keys(out)).toEqual([
      "product",
      "users",
      "organizations",
      "paying",
      "installs",
      "activity",
      "activity_labels",
      "as_of",
      "source",
    ]);
    expect(out.product).toBe("DEALROOM");
    expect(out.users).toBe(7);
    expect(out.paying).toBe(7);
    expect(out.as_of).toBe("2026-09-20T12:00:00.000Z");
    expect(typeof out.source).toBe("string");
  });

  it("keeps null (not applicable) apart from 0 (a measured zero)", async () => {
    const out = await buildCounts(mockDb(() => 0), NOW);
    expect(out.organizations).toBeNull();
    expect(out.installs).toBeNull();
    expect(out.users).toBe(0);
    expect(out.paying).toBe(0);
    for (const value of Object.values(out.activity)) expect(value).toBe(0);
  });

  it("reports 4 to 10 activity figures, each an integer or null, each labelled", async () => {
    const out = await buildCounts(mockDb(() => 3), NOW);
    const keys = Object.keys(out.activity);
    expect(keys.length).toBeGreaterThanOrEqual(4);
    expect(keys.length).toBeLessThanOrEqual(10);
    expect(Object.keys(out.activity_labels)).toEqual(keys);
    expect(out.activity_labels).toEqual(ACTIVITY_LABELS);
    for (const key of keys) {
      expect(key).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*_(total|30d)$/);
      const value = out.activity[key];
      expect(value === null || Number.isInteger(value)).toBe(true);
      const label = (out.activity_labels as Record<string, string>)[key];
      expect(label.length).toBeGreaterThan(0);
      expect(label.split(/\s+/).length).toBeLessThanOrEqual(5);
    }
  });

  it("lets no string from a row reach the output", async () => {
    const leak = "Acme Holdings <ceo@acme-holdings.example>";
    const out = await buildCounts(
      mockDb((model) => (model === "dealRoom" ? leak : { name: leak, _count: 4 })),
      NOW,
    );
    expect(JSON.stringify(out)).not.toContain("Acme");
    expect(JSON.stringify(out)).not.toContain("acme-holdings");
    expect(out.users).toBeNull();
    expect(out.paying).toBeNull();
    for (const value of Object.values(out.activity)) expect(value).toBeNull();
  });

  it("rejects negative and fractional values", async () => {
    const out = await buildCounts(
      mockDb((model) => (model === "user" ? -1 : 2.5)),
      NOW,
    );
    expect(out.users).toBeNull();
    expect(out.activity.deals_created_total).toBeNull();
  });

  it("only ever calls count", async () => {
    const db = mockDb(() => 1);
    await buildCounts(db, NOW);
    // 2 account figures + 10 activity figures
    expect(allCalls(db)).toHaveLength(12);
    for (const [args] of allCalls(db)) {
      const text = JSON.stringify(args ?? {});
      expect(text).not.toContain('"select"');
      expect(text).not.toContain('"include"');
    }
  });

  it("excludes simulator deals and fixture accounts from every activity figure", async () => {
    const db = mockDb(() => 1);
    await buildCounts(db, NOW);

    for (const [args] of (db.dealRoom.count as CountFn).mock.calls) {
      const text = JSON.stringify(args);
      expect(text).toContain('"startsWith":"Demo:"');
      expect(text).toContain("@demo.todo.law");
      expect(text).toContain("tester-startup@todo.law");
      expect(text).toContain('"endsWith":".test"');
    }
    for (const m of [db.agentDealRoom, db.agentDispute, db.customer]) {
      for (const [args] of (m.count as CountFn).mock.calls) {
        expect(JSON.stringify(args)).toContain("@demo.todo.law");
      }
    }
    // users stays every account row; active users is filtered
    const userCalls = (db.user.count as CountFn).mock.calls;
    expect(userCalls[0][0]).toBeUndefined();
    expect(JSON.stringify(userCalls[1][0])).toContain("@demo.todo.law");
  });

  it("counts paying customers as active, unexpired and non-trial", async () => {
    const db = mockDb(() => 1);
    await buildCounts(db, NOW);
    const [args] = (db.customer.count as CountFn).mock.calls[0];
    expect(args.where.entitlements.some).toEqual({
      status: "ACTIVE",
      licenseType: { not: "TRIAL" },
      OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }],
    });
  });

  it("uses a 30 day window for the _30d figures", async () => {
    const db = mockDb(() => 1);
    await buildCounts(db, NOW);
    const windowed = allCalls(db).filter(([args]) =>
      JSON.stringify(args ?? {}).includes(SINCE.toISOString()),
    );
    const expected = Object.keys(ACTIVITY_LABELS).filter((k) => k.endsWith("_30d"));
    expect(windowed).toHaveLength(expected.length);
  });

  it("states in source what was and what could not be excluded", async () => {
    const out = await buildCounts(mockDb(() => 1), NOW);
    expect(out.source).toMatch(/read-only/);
    expect(out.source).toMatch(/excluded from paying and activity/);
    expect(out.source).toMatch(/could not be excluded/);
  });

  it("reduces an error to its class", () => {
    class PrismaClientInitializationError extends Error {}
    const error = new PrismaClientInitializationError(
      "Can't reach database server at db.internal.example:5432",
    );
    expect(errorClass(error)).toBe("PrismaClientInitializationError");
    expect(errorClass("postgres://user:secret@host/db")).toBe("Error");
    expect(errorClass(null)).toBe("Error");
  });

  it("prints no host or credential when the connection fails", () => {
    const script = path.resolve(__dirname, "../../../scripts/count-accounts.mjs");
    // A loopback port nothing listens on: refused at once, no network involved.
    const failed = spawnSync(process.execPath, [script], {
      env: { ...process.env, DATABASE_URL: "postgresql://someuser:somepass@127.0.0.1:1/somedb" },
      encoding: "utf8",
    });
    expect(failed.status).toBe(1);
    expect(failed.stdout).toBe("");
    expect(failed.stderr).toMatch(/^count-accounts: failed \([A-Za-z]+\)\n$/);

    const unset = spawnSync(process.execPath, [script], {
      env: { ...process.env, DATABASE_URL: "" },
      encoding: "utf8",
    });
    expect(unset.status).toBe(2);
    expect(unset.stdout).toBe("");
    expect(unset.stderr).toBe("count-accounts: DATABASE_URL is not set\n");
  }, 30_000);

  it("contains no statement other than count", () => {
    const text = readFileSync(
      path.resolve(__dirname, "../../../scripts/count-accounts.mjs"),
      "utf8",
    );
    expect(text).not.toMatch(
      /\.(findMany|findFirst|findUnique|aggregate|groupBy|create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$queryRaw|\$executeRaw/,
    );
  });
});
