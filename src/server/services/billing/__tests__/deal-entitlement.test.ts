// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Pay per contract: who may download or sign a deal. Hermetic: Prisma and
 * the feature flags are mocked.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const flags = vi.hoisted(() => ({ stripeEnabled: true }));
vi.mock("@/config/features", () => ({ features: flags }));

const db = vi.hoisted(() => {
  const p = {
    dealPayment: { findFirst: vi.fn(), upsert: vi.fn(), create: vi.fn() },
    dealRoom: { findUnique: vi.fn() },
    customer: { findFirst: vi.fn() },
    customerCredit: { updateMany: vi.fn() },
    customerCreditEntry: { create: vi.fn() },
    // Round-1 tables: must never be touched any more.
    contractPlan: { findMany: vi.fn() },
    agentCredit: { updateMany: vi.fn() },
    agentCreditEntry: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  p.$transaction.mockImplementation(async (fn: (tx: typeof p) => unknown) => fn(p));
  return p;
});
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));

import {
  consumeCredit,
  dealAccessForAgent,
  dealAccessForUser,
  isDealPaid,
  paymentRequiredResponse,
  agentPaymentRequiredResponse,
} from "../deal-entitlement";

const START = "2026-10-01";
const AGREED = { status: "AGREED", createdAt: new Date("2026-10-05T00:00:00Z"), signingRequest: null };
const ORIGINAL_START = process.env.CONTRACT_BILLING_START;

beforeEach(() => {
  vi.clearAllMocks();
  flags.stripeEnabled = true;
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  db.dealPayment.findFirst.mockResolvedValue(null);
  db.dealRoom.findUnique.mockResolvedValue(AGREED);
  db.customerCredit.updateMany.mockResolvedValue({ count: 0 });
  process.env.CONTRACT_BILLING_START = START;
});

afterAll(() => {
  if (ORIGINAL_START === undefined) delete process.env.CONTRACT_BILLING_START;
  else process.env.CONTRACT_BILLING_START = ORIGINAL_START;
});

describe("isDealPaid", () => {
  it("treats every deal as paid when Stripe is off, without reading the database", async () => {
    flags.stripeEnabled = false;
    expect(await isDealPaid("d1")).toEqual({ paid: true, via: "billing_off" });
    expect(db.dealPayment.findFirst).not.toHaveBeenCalled();
  });

  it("is paid with a PAID row", async () => {
    db.dealPayment.findFirst.mockResolvedValue({ id: "p1" });
    expect(await isDealPaid("d1")).toEqual({ paid: true, via: "payment" });
    expect(db.dealPayment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dealRoomId: "d1", status: "PAID" } }),
    );
  });

  it("does not charge a deal that was already in signature before billing", async () => {
    db.dealRoom.findUnique.mockResolvedValue({ ...AGREED, status: "COMPLETED" });
    expect(await isDealPaid("d1")).toEqual({ paid: true, via: "predates_billing" });
  });

  it("does not charge a deal from before the billing start", async () => {
    db.dealRoom.findUnique.mockResolvedValue({ ...AGREED, createdAt: new Date("2026-09-20T00:00:00Z") });
    expect(await isDealPaid("d1")).toEqual({ paid: true, via: "predates_billing" });
  });

  it("is unpaid for a deal from after the billing start with no payment", async () => {
    expect(await isDealPaid("d1")).toEqual({ paid: false });
  });
});

describe("dealAccessForUser", () => {
  it("has no plan to fall back on: an unpaid deal stays unpaid", async () => {
    expect(await dealAccessForUser("d1", { id: "u1", email: "a@example.com" })).toEqual({ paid: false });
    expect(db.contractPlan.findMany).not.toHaveBeenCalled();
    expect(db.dealPayment.upsert).not.toHaveBeenCalled();
  });

  it("lets a paid deal through", async () => {
    db.dealPayment.findFirst.mockResolvedValue({ id: "p1" });
    expect(await dealAccessForUser("d1", { id: "u1", email: "a@example.com" })).toEqual({
      paid: true,
      via: "payment",
    });
  });
});

describe("agent credits, held per customer", () => {
  it("spends one of the customer's credits on the first fetch, noting the key", async () => {
    db.customerCredit.updateMany.mockResolvedValue({ count: 1 });
    const access = await dealAccessForAgent("d1", { apiKeyId: "k1", customerId: "c1" });
    expect(access).toEqual({ paid: true, via: "credit" });
    expect(db.customerCredit.updateMany).toHaveBeenCalledWith({
      where: { customerId: "c1", balance: { gte: 1 } },
      data: { balance: { decrement: 1 } },
    });
    expect(db.dealPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "CREDIT",
        dedupeKey: "credit:d1",
        payerApiKeyId: "k1",
        customerId: "c1",
      }),
    });
    expect(db.customerCreditEntry.create).toHaveBeenCalledWith({
      data: { customerId: "c1", apiKeyId: "k1", delta: -1, reason: "CONSUME", dealRoomId: "d1" },
    });
    expect(db.agentCredit.updateMany).not.toHaveBeenCalled();
    expect(db.agentCreditEntry.create).not.toHaveBeenCalled();
  });

  it("draws on the same balance from another key of the customer (a rotated key changes nothing)", async () => {
    db.customerCredit.updateMany.mockResolvedValue({ count: 1 });
    await dealAccessForAgent("d1", { apiKeyId: "k1", customerId: "c1" });
    await dealAccessForAgent("d2", { apiKeyId: "k2-rotated", customerId: "c1" });
    const wheres = db.customerCredit.updateMany.mock.calls.map((c) => c[0].where);
    expect(wheres).toEqual([
      { customerId: "c1", balance: { gte: 1 } },
      { customerId: "c1", balance: { gte: 1 } },
    ]);
  });

  it("does not spend again once the deal is paid", async () => {
    db.dealPayment.findFirst.mockResolvedValue({ id: "p1" });
    expect(await dealAccessForAgent("d1", { apiKeyId: "k1", customerId: "c1" })).toEqual({
      paid: true,
      via: "payment",
    });
    expect(db.customerCredit.updateMany).not.toHaveBeenCalled();
  });

  it("does not spend on a deal from before the billing start", async () => {
    db.dealRoom.findUnique.mockResolvedValue({ ...AGREED, createdAt: new Date("2026-09-20T00:00:00Z") });
    expect(await dealAccessForAgent("d1", { apiKeyId: "k1", customerId: "c1" })).toEqual({
      paid: true,
      via: "predates_billing",
    });
    expect(db.customerCredit.updateMany).not.toHaveBeenCalled();
  });

  it("is unpaid when the customer has no credit left", async () => {
    expect(await dealAccessForAgent("d1", { apiKeyId: "k1", customerId: "c1" })).toEqual({ paid: false });
    expect(db.dealPayment.create).not.toHaveBeenCalled();
  });

  it("treats a lost race on the same deal as paid (the transaction rolled back)", async () => {
    db.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "5" }),
    );
    expect(await consumeCredit({ dealRoomId: "d1", apiKeyId: "k1", customerId: "c1" })).toBe(true);
  });
});

describe("402 responses", () => {
  it("gives a person a plain message and the checkout link, without a plan", async () => {
    const res = paymentRequiredResponse("d1");
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe("PAYMENT_REQUIRED");
    expect(body.error).toMatch(/not paid yet/);
    expect(body.error).not.toMatch(/plan/);
    expect(body.checkout).toEqual({ method: "POST", url: "/api/deals/d1/checkout" });
  });

  it("gives an agent the credit endpoints", async () => {
    const res = agentPaymentRequiredResponse();
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toMatch(/your account has no credits/);
    expect(body.checkout.url).toBe("/api/v1/agent/credits/checkout");
    expect(body.balance.url).toBe("/api/v1/agent/credits/balance");
  });
});
