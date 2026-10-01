// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC
import { describe, it, expect, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ACTIVITY_LABELS,
  REVENUE_KEYS,
  billingStartFrom,
  buildCounts,
  errorClass,
} from "../../../scripts/count-accounts.mjs";

const NOW = new Date("2026-09-20T12:00:00.000Z");
const SINCE = new Date("2026-08-21T12:00:00.000Z");

/** Activity figures that come from the billing statement, not from a count. */
const BILLING_ACTIVITY = [
  "contracts_paid_total",
  "contracts_paid_30d",
  "credit_packs_bought_total",
  "credit_packs_bought_30d",
  "credits_spent_total",
  "credits_spent_30d",
  "refunds_total",
];
const BILLING_COLUMNS = [...BILLING_ACTIVITY, ...REVENUE_KEYS, "paying"];

type CountFn = ReturnType<typeof vi.fn>;

/**
 * A client exposing `count` and one `$queryRaw` (a tagged template), and
 * nothing else: any other call throws. The raw statement answers one row
 * whose every column is `result("billing", column)`.
 */
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
    $queryRaw: vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => [
      Object.fromEntries(BILLING_COLUMNS.map((column) => [column, result("billing", column)])),
    ]),
  };
}

function allCalls(db: ReturnType<typeof mockDb>) {
  const { $queryRaw: _raw, ...models } = db;
  return Object.values(models).flatMap((m) => (m.count as CountFn).mock.calls);
}

/** The raw statement's text and bound values, from the one call made. */
function rawCall(db: ReturnType<typeof mockDb>) {
  expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  const [strings, ...values] = db.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
  return { sql: strings.join("?"), values };
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
      "revenue",
      "as_of",
      "source",
    ]);
    expect(out.product).toBe("DEALROOM");
    expect(out.users).toBe(7);
    expect(out.paying).toBe(7);
    expect(Object.keys(out.revenue)).toEqual(REVENUE_KEYS);
    expect(out.revenue.usd_minor_total).toBe(7);
    expect(out.revenue.first_paid_at).toBeNull(); // not a Date
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
    expect(out.revenue.eur_minor_30d).toBe(0);
  });

  it("keeps every earlier activity figure and adds the billing figures, each labelled", async () => {
    const out = await buildCounts(mockDb(() => 3), NOW);
    const keys = Object.keys(out.activity);
    expect(keys.slice(0, 10)).toEqual([
      "deals_created_total",
      "deals_created_30d",
      "deals_agreed_total",
      "deals_signed_total",
      "deals_signed_30d",
      "agent_negotiations_agreed_total",
      "agent_negotiations_agreed_30d",
      "disputes_filed_total",
      "disputes_filed_30d",
      "active_users_30d",
    ]);
    expect(keys.slice(10)).toEqual(BILLING_ACTIVITY);
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
      mockDb((model) =>
        model === "dealRoom" || model === "billing" ? leak : { name: leak, _count: 4 },
      ),
      NOW,
    );
    expect(JSON.stringify(out)).not.toContain("Acme");
    expect(JSON.stringify(out)).not.toContain("acme-holdings");
    expect(out.users).toBeNull();
    expect(out.paying).toBeNull();
    for (const value of Object.values(out.activity)) expect(value).toBeNull();
    for (const value of Object.values(out.revenue)) expect(value).toBeNull();
  });

  it("answers null when the billing statement returns no single row", async () => {
    const db = mockDb(() => 1);
    db.$queryRaw.mockResolvedValueOnce([]);
    const out = await buildCounts(db, NOW);
    expect(out.paying).toBeNull();
    expect(out.activity.contracts_paid_total).toBeNull();
    expect(out.activity.deals_created_total).toBe(1);
  });

  it("rejects negative and fractional values", async () => {
    const out = await buildCounts(
      mockDb((model) => (model === "user" ? -1 : 2.5)),
      NOW,
    );
    expect(out.users).toBeNull();
    expect(out.activity.deals_created_total).toBeNull();
    expect(out.revenue.usd_minor_total).toBeNull();
  });

  it("turns SUM results (BigInt) into numbers and timestamps into ISO text", async () => {
    const first = new Date("2026-09-01T10:00:00.000Z");
    const db = mockDb((model, column) => {
      if (model !== "billing") return 1;
      if (column === "usd_minor_total") return BigInt(5800);
      if (column === "eur_minor_total") return BigInt(-1);
      if (column === "first_paid_at") return first;
      if (column === "last_paid_at") return "2026-09-02";
      return 2;
    });
    const out = await buildCounts(db, NOW);
    expect(out.revenue.usd_minor_total).toBe(5800);
    expect(out.revenue.eur_minor_total).toBeNull();
    expect(out.revenue.first_paid_at).toBe("2026-09-01T10:00:00.000Z");
    expect(out.revenue.last_paid_at).toBeNull();
  });

  it("only ever calls count, plus one statement of aggregates", async () => {
    const db = mockDb(() => 1);
    await buildCounts(db, NOW);
    // users + 10 activity figures
    expect(allCalls(db)).toHaveLength(11);
    for (const [args] of allCalls(db)) {
      const text = JSON.stringify(args ?? {});
      expect(text).not.toContain('"select"');
      expect(text).not.toContain('"include"');
    }
    const { sql, values } = rawCall(db);
    expect(sql.trimStart()).toMatch(/^WITH /);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|COPY|SET)\b/i);
    expect(sql).not.toMatch(/\*\s*FROM|\.\*/);
    // Every column of the outer SELECT is an aggregate.
    const outer = sql.slice(sql.lastIndexOf("\n    SELECT\n"));
    for (const column of BILLING_COLUMNS) expect(outer).toContain(`AS ${column}`);
    // Values are bound, never spliced into the text.
    for (const value of values) {
      expect(value === null || typeof value === "string" || Array.isArray(value)).toBe(true);
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
    for (const m of [db.agentDealRoom, db.agentDispute]) {
      for (const [args] of (m.count as CountFn).mock.calls) {
        expect(JSON.stringify(args)).toContain("@demo.todo.law");
      }
    }
    // users stays every account row; active users is filtered
    const userCalls = (db.user.count as CountFn).mock.calls;
    expect(userCalls[0][0]).toBeUndefined();
    expect(JSON.stringify(userCalls[1][0])).toContain("@demo.todo.law");

    // The billing statement applies the same exclusions.
    const { sql, values } = rawCall(db);
    expect(values).toContainEqual([
      "%@demo.todo.law",
      "%.test",
      "%@example.com",
      "tester-startup@todo.law",
      "tester-lawyer@todo.law",
      "tester-business@todo.law",
    ]);
    expect(values).toContain("Demo:%");
    expect(sql).toContain("fixture_customers");
    expect(sql).toContain("fixture_users");
    expect(sql).toContain("real_deals");
  });

  it("counts paying customers as paid since the billing start, plus active non-trial entitlements", async () => {
    const db = mockDb(() => 1);
    await buildCounts(db, NOW, { billingStart: billingStartFrom("2026-10-01") });
    const { sql, values } = rawCall(db);
    expect(sql).toContain("skill_entitlements");
    expect(sql).toContain("s.status::text = 'ACTIVE'");
    expect(sql).toContain(`s."licenseType"::text <> 'TRIAL'`);
    expect(values).toContain(NOW.toISOString());
    expect(values).toContain("2026-10-01T00:00:00.000Z");

    const without = mockDb(() => 1);
    const out = await buildCounts(without, NOW);
    expect(rawCall(without).values).toContain(null);
    expect(out.source).toMatch(/CONTRACT_BILLING_START not given/);
  });

  it("reads the billing start as the app does", () => {
    expect(billingStartFrom("2026-10-01")?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(billingStartFrom(" ")).toBeNull();
    expect(billingStartFrom("not a date")).toBeNull();
    expect(billingStartFrom(undefined)).toBeNull();
  });

  it("uses a 30 day window for the _30d figures", async () => {
    const db = mockDb(() => 1);
    await buildCounts(db, NOW);
    const windowed = allCalls(db).filter(([args]) =>
      JSON.stringify(args ?? {}).includes(SINCE.toISOString()),
    );
    const expected = Object.keys(ACTIVITY_LABELS).filter(
      (k) => k.endsWith("_30d") && !BILLING_ACTIVITY.includes(k),
    );
    expect(windowed).toHaveLength(expected.length);
    expect(rawCall(db).values).toContain(SINCE.toISOString());
  });

  it("states in source what was and what could not be excluded", async () => {
    const out = await buildCounts(mockDb(() => 1), NOW);
    expect(out.source).toMatch(/read-only/);
    expect(out.source).toMatch(/excluded from paying, activity and revenue/);
    expect(out.source).toMatch(/could not be excluded/);
    expect(out.source).toMatch(/partial refunds are not recorded/);
    expect(out.source).toMatch(/credit pack amounts are not recorded/);
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

  it("contains no statement other than count and one tagged $queryRaw", () => {
    const text = readFileSync(
      path.resolve(__dirname, "../../../scripts/count-accounts.mjs"),
      "utf8",
    );
    expect(text).not.toMatch(
      /\.(findMany|findFirst|findUnique|aggregate|groupBy|create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$queryRawUnsafe|\$executeRaw/,
    );
    // Tagged template only: values are bound, never concatenated.
    expect(text.match(/\$queryRaw/g)).toHaveLength(text.match(/\$queryRaw`/g)?.length ?? -1);
    expect(text.match(/db\.\$queryRaw`/g)).toHaveLength(1);
  });
});

/**
 * Against a real database, only when one is named: the local Docker
 * database (`docker-compose.dev.yml`), never production. For example
 *   COUNT_ACCOUNTS_TEST_DATABASE_URL=postgresql://…@127.0.0.1:54329/… npm run test:run -- count-accounts
 */
const LIVE_URL = process.env.COUNT_ACCOUNTS_TEST_DATABASE_URL;

describe.skipIf(!LIVE_URL)("count-accounts against a local database", () => {
  it("runs every statement and returns the contract shape", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient({ datasources: { db: { url: LIVE_URL } }, log: [] });
    try {
      const out = await buildCounts(db, new Date(), { billingStart: billingStartFrom("2026-01-01") });
      expect(Number.isInteger(out.users)).toBe(true);
      expect(Number.isInteger(out.paying)).toBe(true);
      for (const key of Object.keys(ACTIVITY_LABELS)) {
        expect(Number.isInteger(out.activity[key])).toBe(true);
      }
      for (const key of REVENUE_KEYS) {
        const value = out.revenue[key];
        if (key.endsWith("_at")) {
          expect(value === null || /^\d{4}-\d\d-\d\dT/.test(value)).toBe(true);
        } else {
          expect(Number.isInteger(value)).toBe(true);
        }
      }
    } finally {
      await db.$disconnect();
    }
  }, 30_000);
});
