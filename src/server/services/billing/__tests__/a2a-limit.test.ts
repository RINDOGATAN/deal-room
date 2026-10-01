// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory stand-ins for the three billing tables and the counter table.
let balance: number | null = null;
let entries: { customerId: string; reason: string; createdAt: Date; stripeCheckoutSessionId: string | null }[] = [];
let payments: { customerId: string; status: string; kind: string; paidAt: Date }[] = [];
const counters = new Map<string, number>();

type Where = Record<string, unknown> & {
  customerId: string;
  reason?: string;
  createdAt?: { gte: Date };
  stripeCheckoutSessionId?: { in: string[] };
};

vi.mock("@/lib/prisma", () => {
  const p = {
    customerCredit: {
      findUnique: vi.fn(async () => (balance === null ? null : { balance })),
    },
    customerCreditEntry: {
      findMany: vi.fn(async ({ where }: { where: Where }) =>
        entries.filter(
          (e) =>
            e.customerId === where.customerId &&
            (!where.reason || e.reason === where.reason) &&
            (!where.createdAt || e.createdAt >= where.createdAt.gte) &&
            (!where.stripeCheckoutSessionId ||
              (e.stripeCheckoutSessionId !== null && where.stripeCheckoutSessionId.in.includes(e.stripeCheckoutSessionId))),
        ),
      ),
    },
    dealPayment: {
      findFirst: vi.fn(
        async ({ where }: { where: { customerId: string; status: string; kind: { in: string[] }; paidAt: { gte: Date } } }) =>
          payments.find(
            (p) =>
              p.customerId === where.customerId &&
              p.status === where.status &&
              where.kind.in.includes(p.kind) &&
              p.paidAt >= where.paidAt.gte,
          ) ?? null,
      ),
    },
    rateLimitCounter: {
      upsert: vi.fn(async ({ where }: { where: { key: string } }) => {
        const count = (counters.get(where.key) ?? 0) + 1;
        counters.set(where.key, count);
        return { key: where.key, count };
      }),
    },
  };
  return { prisma: p, default: p };
});

import {
  a2aLimitMessage,
  hasExtendedA2aLimit,
  qualifiesForExtendedA2a,
} from "../a2a-limit";
import { checkA2aRateLimit } from "@/server/middleware/apiKeyAuth";

const env = { CONTRACT_BILLING_START: "2026-10-01" };
const customer = { id: "cus_1", metadata: {} };
const after = new Date("2026-10-05T00:00:00Z");
const before = new Date("2026-09-20T00:00:00Z");

beforeEach(() => {
  balance = null;
  entries = [];
  payments = [];
  counters.clear();
});

describe("qualifiesForExtendedA2a", () => {
  const none = { premiumFlag: false, creditBalance: 0, packSinceStart: false, paymentSinceStart: false };
  it("is false with nothing", () => expect(qualifiesForExtendedA2a(none)).toBe(false));
  it("is true for each single reason", () => {
    expect(qualifiesForExtendedA2a({ ...none, premiumFlag: true })).toBe(true);
    expect(qualifiesForExtendedA2a({ ...none, creditBalance: 1 })).toBe(true);
    expect(qualifiesForExtendedA2a({ ...none, packSinceStart: true })).toBe(true);
    expect(qualifiesForExtendedA2a({ ...none, paymentSinceStart: true })).toBe(true);
  });
});

describe("hasExtendedA2aLimit", () => {
  it("a customer with no credits, no pack and no payment keeps the standard limit", async () => {
    expect(await hasExtendedA2aLimit(customer, env)).toBe(false);
  });

  it("qualifies with a credit balance above zero", async () => {
    balance = 3;
    expect(await hasExtendedA2aLimit(customer, env)).toBe(true);
  });

  it("does not qualify with a zero balance alone", async () => {
    balance = 0;
    expect(await hasExtendedA2aLimit(customer, env)).toBe(false);
  });

  it("qualifies with a pack bought since the billing start, even once spent", async () => {
    balance = 0;
    entries = [{ customerId: "cus_1", reason: "PURCHASE", createdAt: after, stripeCheckoutSessionId: "cs_1" }];
    expect(await hasExtendedA2aLimit(customer, env)).toBe(true);
  });

  it("does not count a pack bought before the start, or one reversed", async () => {
    entries = [{ customerId: "cus_1", reason: "PURCHASE", createdAt: before, stripeCheckoutSessionId: "cs_0" }];
    expect(await hasExtendedA2aLimit(customer, env)).toBe(false);
    entries = [
      { customerId: "cus_1", reason: "PURCHASE", createdAt: after, stripeCheckoutSessionId: "cs_1" },
      { customerId: "cus_1", reason: "REVERSAL", createdAt: after, stripeCheckoutSessionId: "cs_1" },
    ];
    expect(await hasExtendedA2aLimit(customer, env)).toBe(false);
  });

  it("qualifies with a contract paid since the billing start", async () => {
    payments = [{ customerId: "cus_1", status: "PAID", kind: "CONTRACT", paidAt: after }];
    expect(await hasExtendedA2aLimit(customer, env)).toBe(true);
  });

  it("does not count a payment before the start, a revoked one, or any when the start is unset", async () => {
    payments = [
      { customerId: "cus_1", status: "PAID", kind: "CONTRACT", paidAt: before },
      { customerId: "cus_1", status: "REVOKED", kind: "CONTRACT", paidAt: after },
    ];
    expect(await hasExtendedA2aLimit(customer, env)).toBe(false);
    payments = [{ customerId: "cus_1", status: "PAID", kind: "CONTRACT", paidAt: after }];
    expect(await hasExtendedA2aLimit(customer, {})).toBe(false);
  });

  it("keeps the premiumA2A flag working", async () => {
    expect(await hasExtendedA2aLimit({ id: "cus_1", metadata: { premiumA2A: true } }, env)).toBe(true);
  });
});

describe("checkA2aRateLimit", () => {
  it("allows 5 per contract type per week on the standard limit", async () => {
    for (let i = 0; i < 5; i++) expect((await checkA2aRateLimit("cus_1", "A2A_X", false)).allowed).toBe(true);
    expect((await checkA2aRateLimit("cus_1", "A2A_X", false)).allowed).toBe(false);
    expect((await checkA2aRateLimit("cus_1", "A2A_Y", false)).allowed).toBe(true);
  });

  it("allows 300 a week in total on the extended limit", async () => {
    for (let i = 0; i < 300; i++) {
      expect((await checkA2aRateLimit("cus_1", i % 2 ? "A2A_X" : "A2A_Y", true)).allowed).toBe(true);
    }
    expect((await checkA2aRateLimit("cus_1", "A2A_Z", true)).allowed).toBe(false);
  });
});

describe("a2aLimitMessage", () => {
  it("states the standard limit, the extended limit and how to lift it", () => {
    const msg = a2aLimitMessage(false, "https://dealroom.todo.law/pricing");
    expect(msg).toContain("5 negotiations per contract type per week");
    expect(msg).toContain("300 a week");
    expect(msg).toContain("buy_credits");
    expect(msg).toContain("https://dealroom.todo.law/pricing");
    expect(msg).not.toMatch(/upgrade|premium tier/i);
  });

  it("offers no purchase when billing is off", () => {
    expect(a2aLimitMessage(false, null)).not.toContain("buy_credits");
  });

  it("states the extended limit once reached", () => {
    expect(a2aLimitMessage(true, null)).toContain("300");
  });
});
