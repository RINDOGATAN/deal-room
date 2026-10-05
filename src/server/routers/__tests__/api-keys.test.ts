// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Settings, API keys (`apiKeys` router) against a small in-memory store,
 * together with the agent API's own key check (`authenticateApiKey`):
 * the full key is returned once and only its hash is stored; the list
 * never carries a hash; one person can neither see, revoke nor spend
 * another customer's keys; a revoked key is refused by the agent API; the
 * active-key limit holds; and the page does not exist where billing is off.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { NextRequest } from "next/server";
import { createHash } from "crypto";

type KeyRow = {
  id: string;
  customerId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
};
type CustomerRow = { id: string; email: string; name: string; type: string };

const db = vi.hoisted(() => ({
  customers: [] as CustomerRow[],
  apiKeys: [] as KeyRow[],
  credits: [] as { customerId: string; balance: number }[],
  audit: [] as { action: string; userId?: string; details: Record<string, unknown> }[],
  counters: new Map<string, number>(),
  seq: 0,
}));

const flags = vi.hoisted(() => ({ selfServiceApiKeys: true, hostedPilot: false, agentApi: true }));

const fake = vi.hoisted(() => {
  const pick = (row: Record<string, unknown>, select?: Record<string, boolean>) => {
    if (!select) return { ...row };
    return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
  };
  type Where = {
    id?: string;
    customerId?: string;
    isActive?: boolean;
    keyHash?: string;
    OR?: [unknown, { expiresAt: { gt: Date } }];
  };
  const matches = (k: Record<string, unknown>, where: Where) => {
    if (where.id !== undefined && k.id !== where.id) return false;
    if (where.customerId !== undefined && k.customerId !== where.customerId) return false;
    if (where.isActive !== undefined && k.isActive !== where.isActive) return false;
    if (where.keyHash !== undefined && k.keyHash !== where.keyHash) return false;
    if (where.OR) {
      const now = where.OR[1].expiresAt.gt;
      const exp = k.expiresAt as Date | null;
      if (!(exp === null || exp > now)) return false;
    }
    return true;
  };
  return { pick, matches };
});

vi.mock("@/lib/prisma", () => {
  const { pick, matches } = fake;
  const prisma = {
    customer: {
      findFirst: vi.fn(async ({ where, select }: { where: { email: { equals: string } }; select?: Record<string, boolean> }) => {
        const row = db.customers.find((c) => c.email.toLowerCase() === where.email.equals.toLowerCase());
        return row ? pick(row, select) : null;
      }),
      create: vi.fn(async ({ data, select }: { data: Omit<CustomerRow, "id">; select?: Record<string, boolean> }) => {
        const row = { id: `cust_${++db.seq}`, ...data };
        db.customers.push(row);
        return pick(row, select);
      }),
    },
    apiKey: {
      findMany: vi.fn(async ({ where, select }: { where: object; select?: Record<string, boolean> }) =>
        db.apiKeys.filter((k) => matches(k, where)).map((k) => pick(k, select)),
      ),
      findFirst: vi.fn(async ({ where, select }: { where: object; select?: Record<string, boolean> }) => {
        const row = db.apiKeys.find((k) => matches(k, where));
        return row ? pick(row, select) : null;
      }),
      findUnique: vi.fn(async ({ where }: { where: { keyHash: string } }) => {
        const row = db.apiKeys.find((k) => k.keyHash === where.keyHash);
        if (!row) return null;
        return { ...row, customer: db.customers.find((c) => c.id === row.customerId) };
      }),
      count: vi.fn(async ({ where }: { where: object }) => db.apiKeys.filter((k) => matches(k, where)).length),
      create: vi.fn(async ({ data, select }: { data: Partial<KeyRow>; select?: Record<string, boolean> }) => {
        const row = {
          id: `key_${++db.seq}`,
          isActive: true,
          lastUsedAt: null,
          expiresAt: null,
          createdAt: new Date(),
          ...data,
        } as KeyRow;
        db.apiKeys.push(row);
        return pick(row, select);
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<KeyRow> }) => {
        const row = db.apiKeys.find((k) => k.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: object; data: Partial<KeyRow> }) => {
        const rows = db.apiKeys.filter((k) => matches(k, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      }),
    },
    customerCredit: {
      findUnique: vi.fn(async ({ where }: { where: { customerId: string } }) =>
        db.credits.find((c) => c.customerId === where.customerId) ?? null,
      ),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: { action: string; userId?: string; details: Record<string, unknown> } }) => {
        db.audit.push(data);
        return data;
      }),
    },
    rateLimitCounter: {
      upsert: vi.fn(async ({ where }: { where: { key: string } }) => {
        const count = (db.counters.get(where.key) ?? 0) + 1;
        db.counters.set(where.key, count);
        return { key: where.key, count };
      }),
    },
  };
  return { default: prisma, prisma };
});
vi.mock("@/config/features", () => ({ features: flags }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ decode: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({ get: () => null }),
}));

import { createInnerTRPCContext } from "@/server/trpc";
import { apiKeysRouter } from "@/server/routers/apiKeys";
import { authenticateApiKey } from "@/server/middleware/apiKeyAuth";
import { MAX_ACTIVE_KEYS_PER_CUSTOMER, SELF_SERVICE_SCOPES } from "@/lib/api-key-scopes";

function session(id: string, email: string): Session {
  return {
    user: { id, email, name: id, role: null },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}
const alice = session("user-alice", "alice@example.test");
const bob = session("user-bob", "bob@example.test");

function callerFor(s: Session | null) {
  return apiKeysRouter.createCaller(
    createInnerTRPCContext({ session: s, adminSession: null, supervisorSession: null, getCookie: () => undefined }),
  );
}

function agentRequest(key: string) {
  return new NextRequest("https://dealroom.test/api/v1/agent/credits/balance", {
    headers: { Authorization: `Bearer ${key}` },
  });
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

beforeEach(() => {
  db.customers.length = 0;
  db.apiKeys.length = 0;
  db.credits.length = 0;
  db.audit.length = 0;
  db.counters.clear();
  flags.selfServiceApiKeys = true;
});

describe("apiKeys.create", () => {
  it("returns the full key once and stores only its hash and prefix", async () => {
    const created = await callerFor(alice).create({ name: "Procurement agent" });

    expect(created.key).toMatch(/^drk_[0-9a-f]{64}$/);
    expect(created.keyPrefix).toBe(created.key.slice(0, 12));
    expect(created.scopes).toEqual(SELF_SERVICE_SCOPES);
    expect(created).not.toHaveProperty("keyHash");

    const stored = db.apiKeys[0];
    expect(stored.keyHash).toBe(sha(created.key));
    expect(Object.values(stored)).not.toContain(created.key);

    // The person's customer was created on the first key, by e-mail.
    expect(db.customers).toHaveLength(1);
    expect(db.customers[0].email).toBe("alice@example.test");
    expect(stored.customerId).toBe(db.customers[0].id);

    // Audited without the key or its hash.
    expect(db.audit).toHaveLength(1);
    expect(db.audit[0]).toMatchObject({ action: "API_KEY_CREATED", userId: "user-alice" });
    expect(JSON.stringify(db.audit)).not.toContain(created.key);
    expect(JSON.stringify(db.audit)).not.toContain(stored.keyHash);
  });

  it("reuses the existing customer with the person's e-mail (any case)", async () => {
    db.customers.push({ id: "cust_existing", email: "Alice@Example.test", name: "Alice", type: "SAAS" });
    await callerFor(alice).create({ name: "k" });
    expect(db.customers).toHaveLength(1);
    expect(db.apiKeys[0].customerId).toBe("cust_existing");
  });

  it("holds the active-key limit, and a revoked key frees a slot", async () => {
    const caller = callerFor(alice);
    const made = [];
    for (let i = 0; i < MAX_ACTIVE_KEYS_PER_CUSTOMER; i++) made.push(await caller.create({ name: `k${i}` }));
    await expect(caller.create({ name: "one too many" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.apiKeys).toHaveLength(MAX_ACTIVE_KEYS_PER_CUSTOMER);

    await caller.revoke({ apiKeyId: made[0].id });
    await expect(caller.create({ name: "replacement" })).resolves.toMatchObject({ name: "replacement" });
  });

  it("does not count expired keys as active", async () => {
    db.customers.push({ id: "cust_a", email: "alice@example.test", name: "Alice", type: "SAAS" });
    for (let i = 0; i < MAX_ACTIVE_KEYS_PER_CUSTOMER; i++) {
      db.apiKeys.push({
        id: `old_${i}`, customerId: "cust_a", name: "old", keyHash: `h${i}`, keyPrefix: "drk_00000000",
        scopes: [], isActive: true, lastUsedAt: null, expiresAt: new Date(Date.now() - 1000), createdAt: new Date(),
      });
    }
    await expect(callerFor(alice).create({ name: "fresh" })).resolves.toMatchObject({ name: "fresh" });
  });

  it("is rate limited per person", async () => {
    // Revoke as we go so the active-key limit is not what stops us.
    const caller = callerFor(alice);
    for (let i = 0; i < 10; i++) {
      const k = await caller.create({ name: `k${i}` });
      await caller.revoke({ apiKeyId: k.id });
    }
    await expect(caller.create({ name: "eleventh" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("rejects an empty name", async () => {
    await expect(callerFor(alice).create({ name: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("apiKeys.overview", () => {
  it("lists the person's keys and balance, never a hash", async () => {
    const created = await callerFor(alice).create({ name: "mine" });
    db.credits.push({ customerId: db.customers[0].id, balance: 7 });

    const view = await callerFor(alice).overview();
    expect(view.balance).toBe(7);
    expect(view.activeCount).toBe(1);
    expect(view.maxActive).toBe(MAX_ACTIVE_KEYS_PER_CUSTOMER);
    expect(view.keys).toHaveLength(1);
    expect(view.keys[0]).toMatchObject({ id: created.id, name: "mine", keyPrefix: created.keyPrefix });
    expect(view.keys[0]).not.toHaveProperty("keyHash");
    expect(view.keys[0]).not.toHaveProperty("key");
    expect(JSON.stringify(view)).not.toContain(db.apiKeys[0].keyHash);
  });

  it("is empty for a person without a customer, and creates nothing", async () => {
    const view = await callerFor(alice).overview();
    expect(view).toMatchObject({ keys: [], activeCount: 0, balance: 0 });
    expect(db.customers).toHaveLength(0);
  });

  it("never shows another customer's keys", async () => {
    await callerFor(bob).create({ name: "bob's key" });
    await callerFor(alice).create({ name: "alice's key" });
    const view = await callerFor(alice).overview();
    expect(view.keys.map((k) => k.name)).toEqual(["alice's key"]);
  });
});

describe("apiKeys.revoke", () => {
  it("cannot revoke another customer's key (reads as not found)", async () => {
    const bobs = await callerFor(bob).create({ name: "bob's key" });
    await callerFor(alice).create({ name: "alice's key" });

    await expect(callerFor(alice).revoke({ apiKeyId: bobs.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.apiKeys.find((k) => k.id === bobs.id)!.isActive).toBe(true);
  });

  it("a person with no customer cannot revoke anything", async () => {
    const bobs = await callerFor(bob).create({ name: "bob's key" });
    await expect(callerFor(alice).revoke({ apiKeyId: bobs.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("revokes the person's own key and audits it", async () => {
    const mine = await callerFor(alice).create({ name: "mine" });
    await expect(callerFor(alice).revoke({ apiKeyId: mine.id })).resolves.toEqual({
      success: true,
      alreadyRevoked: false,
    });
    expect(db.apiKeys[0].isActive).toBe(false);
    expect(db.audit.map((a) => a.action)).toEqual(["API_KEY_CREATED", "API_KEY_REVOKED"]);
  });
});

describe("the agent API's key check", () => {
  it("accepts a new key as its own customer, and refuses it once revoked", async () => {
    const mine = await callerFor(alice).create({ name: "mine" });
    const auth = await authenticateApiKey(agentRequest(mine.key));
    expect(auth?.customer.id).toBe(db.customers[0].id);
    expect(auth?.apiKey.id).toBe(mine.id);

    await callerFor(alice).revoke({ apiKeyId: mine.id });
    await expect(authenticateApiKey(agentRequest(mine.key))).resolves.toBeNull();
  });

  it("a key always acts for the customer that owns it, never another", async () => {
    const bobs = await callerFor(bob).create({ name: "bob's key" });
    await callerFor(alice).create({ name: "alice's key" });
    const auth = await authenticateApiKey(agentRequest(bobs.key));
    const bobCustomer = db.customers.find((c) => c.email === "bob@example.test")!;
    expect(auth?.customer.id).toBe(bobCustomer.id);
  });

  it("refuses a made-up key with a valid shape", async () => {
    await expect(authenticateApiKey(agentRequest(`drk_${"0".repeat(64)}`))).resolves.toBeNull();
  });
});

describe("gating", () => {
  it("does not exist where billing is off (self-host)", async () => {
    flags.selfServiceApiKeys = false;
    await expect(callerFor(alice).overview()).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(callerFor(alice).create({ name: "k" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.apiKeys).toHaveLength(0);
  });

  it("needs a signed-in session", async () => {
    await expect(callerFor(null).overview()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
