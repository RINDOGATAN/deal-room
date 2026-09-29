// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Pay per contract: who may download or sign a deal. Hermetic: Prisma and
 * the feature flags are mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const flags = vi.hoisted(() => ({ stripeEnabled: true }));
vi.mock("@/config/features", () => ({ features: flags }));

const db = vi.hoisted(() => {
  const p = {
    dealPayment: { findFirst: vi.fn(), upsert: vi.fn(), create: vi.fn() },
    dealRoom: { findUnique: vi.fn() },
    customer: { findFirst: vi.fn() },
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

const AGREED = { status: "AGREED", createdAt: new Date("2026-10-05T00:00:00Z"), signingRequest: null };
const FUTURE = new Date(Date.now() + 10 * 86400_000);

beforeEach(() => {
  vi.clearAllMocks();
  flags.stripeEnabled = true;
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  db.dealPayment.findFirst.mockResolvedValue(null);
  db.dealRoom.findUnique.mockResolvedValue(AGREED);
  db.customer.findFirst.mockResolvedValue(null);
  db.contractPlan.findMany.mockResolvedValue([]);
  db.agentCredit.updateMany.mockResolvedValue({ count: 0 });
  delete process.env.CONTRACT_BILLING_START;
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

  it("is unpaid for an agreed deal with no payment", async () => {
    expect(await isDealPaid("d1")).toEqual({ paid: false });
  });
});

describe("dealAccessForUser", () => {
  it("records the plan's coverage when the person holds an active monthly plan", async () => {
    db.customer.findFirst.mockResolvedValue({ id: "c1" });
    db.contractPlan.findMany.mockResolvedValue([
      { stripeSubscriptionId: "sub_1", status: "active", currentPeriodEnd: FUTURE },
    ]);
    const access = await dealAccessForUser("d1", { id: "u1", email: "a@example.com" });
    expect(access).toEqual({ paid: true, via: "plan" });
    expect(db.dealPayment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dedupeKey: "plan:d1" },
        create: expect.objectContaining({ kind: "PLAN", payerUserId: "u1", stripeSubscriptionId: "sub_1" }),
      }),
    );
  });

  it("refuses when the plan is past due", async () => {
    db.customer.findFirst.mockResolvedValue({ id: "c1" });
    db.contractPlan.findMany.mockResolvedValue([
      { stripeSubscriptionId: "sub_1", status: "past_due", currentPeriodEnd: FUTURE },
    ]);
    expect(await dealAccessForUser("d1", { id: "u1", email: "a@example.com" })).toEqual({ paid: false });
    expect(db.dealPayment.upsert).not.toHaveBeenCalled();
  });
});

describe("agent credits", () => {
  it("spends one credit on the first fetch and writes the deal payment and the ledger entry", async () => {
    db.agentCredit.updateMany.mockResolvedValue({ count: 1 });
    const access = await dealAccessForAgent("d1", { apiKeyId: "k1", customerId: "c1" });
    expect(access).toEqual({ paid: true, via: "credit" });
    expect(db.agentCredit.updateMany).toHaveBeenCalledWith({
      where: { apiKeyId: "k1", balance: { gte: 1 } },
      data: { balance: { decrement: 1 } },
    });
    expect(db.dealPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "CREDIT", dedupeKey: "credit:d1", payerApiKeyId: "k1" }),
    });
    expect(db.agentCreditEntry.create).toHaveBeenCalledWith({
      data: { apiKeyId: "k1", delta: -1, reason: "CONSUME", dealRoomId: "d1" },
    });
  });

  it("does not spend again once the deal is paid", async () => {
    db.dealPayment.findFirst.mockResolvedValue({ id: "p1" });
    expect(await dealAccessForAgent("d1", { apiKeyId: "k1", customerId: "c1" })).toEqual({
      paid: true,
      via: "payment",
    });
    expect(db.agentCredit.updateMany).not.toHaveBeenCalled();
  });

  it("is unpaid with no credit left", async () => {
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
  it("gives a person a plain message and the checkout link", async () => {
    const res = paymentRequiredResponse("d1");
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe("PAYMENT_REQUIRED");
    expect(body.error).toMatch(/not paid yet/);
    expect(body.checkout).toEqual({ method: "POST", url: "/api/deals/d1/checkout" });
  });

  it("gives an agent the credit endpoints", async () => {
    const res = agentPaymentRequiredResponse();
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.checkout.url).toBe("/api/v1/agent/credits/checkout");
    expect(body.balance.url).toBe("/api/v1/agent/credits/balance");
  });
});
