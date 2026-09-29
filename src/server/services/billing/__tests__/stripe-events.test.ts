// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Pay-per-contract webhook handlers, against trimmed Stripe fixtures.
 * Prisma is mocked; the assertions are on what would be written.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import * as fx from "./fixtures/stripe-events";

const db = vi.hoisted(() => {
  const p = {
    dealPayment: { upsert: vi.fn(), updateMany: vi.fn() },
    agentCredit: { upsert: vi.fn(), update: vi.fn() },
    agentCreditEntry: { create: vi.fn(), findFirst: vi.fn() },
    contractPlan: { upsert: vi.fn() },
    $transaction: vi.fn(),
  };
  return p;
});
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));

import {
  billingKindOf,
  fulfilCheckoutSession,
  handleChargeRefunded,
  handleCheckoutPaymentFailed,
  syncPlanSubscription,
} from "../stripe-events";

const retrieveSubscription = vi.fn(async () => fx.planSubscriptionActive);
const unique = () => new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "5" });

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  db.dealPayment.updateMany.mockResolvedValue({ count: 1 });
  db.agentCreditEntry.findFirst.mockResolvedValue(null);
});

describe("checkout.session.completed", () => {
  it("marks the deal paid for a paid contract checkout", async () => {
    expect(await fulfilCheckoutSession(fx.contractSessionPaid, retrieveSubscription)).toBe(true);
    expect(db.dealPayment.upsert).toHaveBeenCalledWith({
      where: { stripeCheckoutSessionId: "cs_test_contract_1" },
      update: { stripePaymentIntentId: "pi_test_contract_1" },
      create: expect.objectContaining({
        dealRoomId: "deal_1",
        kind: "CONTRACT",
        status: "PAID",
        payerUserId: "user_1",
        amount: 2900,
        currency: "eur",
        stripePaymentIntentId: "pi_test_contract_1",
      }),
    });
  });

  it("does not unlock a checkout whose payment is still pending", async () => {
    await fulfilCheckoutSession(fx.contractSessionUnpaid, retrieveSubscription);
    expect(db.dealPayment.upsert).not.toHaveBeenCalled();
  });

  it("adds ten credits to the key for a paid pack", async () => {
    await fulfilCheckoutSession(fx.creditsSessionPaid, retrieveSubscription);
    expect(db.agentCreditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        apiKeyId: "key_1",
        delta: 10,
        reason: "PURCHASE",
        stripeCheckoutSessionId: "cs_test_credits_1",
      }),
    });
    expect(db.agentCredit.update).toHaveBeenCalledWith({
      where: { apiKeyId: "key_1" },
      data: { balance: { increment: 10 } },
    });
  });

  it("credits a pack only once when the event is delivered again", async () => {
    db.agentCreditEntry.create.mockRejectedValueOnce(unique());
    await expect(fulfilCheckoutSession(fx.creditsSessionPaid, retrieveSubscription)).resolves.toBe(true);
    // The balance update sits after the failed insert in the same transaction.
    expect(db.agentCredit.update).not.toHaveBeenCalled();
  });

  it("stores the monthly plan from its subscription", async () => {
    await fulfilCheckoutSession(fx.planSessionComplete, retrieveSubscription);
    expect(retrieveSubscription).toHaveBeenCalledWith("sub_test_plan_1");
    expect(db.contractPlan.upsert).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_test_plan_1" },
      update: expect.objectContaining({ status: "active" }),
      create: expect.objectContaining({ customerId: "cust_3", status: "active" }),
    });
  });

  it("leaves legacy per-skill sessions to the old handler", async () => {
    expect(billingKindOf(fx.legacySkillSession.metadata)).toBeNull();
    expect(await fulfilCheckoutSession(fx.legacySkillSession, retrieveSubscription)).toBe(false);
    expect(db.dealPayment.upsert).not.toHaveBeenCalled();
  });
});

describe("failed and refunded payments revert the entitlement", () => {
  it("revokes a contract on a full refund", async () => {
    await handleChargeRefunded(fx.chargeFullyRefunded);
    expect(db.dealPayment.updateMany).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: "pi_test_contract_1", kind: "CONTRACT", status: "PAID" },
      data: expect.objectContaining({ status: "REVOKED", revokedReason: "refunded" }),
    });
  });

  it("keeps the entitlement on a partial refund", async () => {
    await handleChargeRefunded(fx.chargePartiallyRefunded);
    expect(db.dealPayment.updateMany).not.toHaveBeenCalled();
  });

  it("takes back a refunded credit pack", async () => {
    db.agentCreditEntry.findFirst.mockResolvedValue({
      apiKeyId: "key_1",
      delta: 10,
      stripeCheckoutSessionId: "cs_test_credits_1",
      stripePaymentIntentId: "pi_test_credits_1",
    });
    await handleChargeRefunded(fx.creditsChargeRefunded);
    expect(db.agentCreditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ apiKeyId: "key_1", delta: -10, reason: "REVERSAL" }),
    });
    expect(db.agentCredit.update).toHaveBeenCalledWith({
      where: { apiKeyId: "key_1" },
      data: { balance: { decrement: 10 } },
    });
  });

  it("revokes a contract whose delayed payment failed", async () => {
    await handleCheckoutPaymentFailed(fx.contractSessionUnpaid);
    expect(db.dealPayment.updateMany).toHaveBeenCalledWith({
      where: { stripeCheckoutSessionId: "cs_test_contract_async", kind: "CONTRACT", status: "PAID" },
      data: expect.objectContaining({ status: "REVOKED", revokedReason: "payment_failed" }),
    });
  });

  it("follows the plan's status: past due no longer covers new contracts", async () => {
    await syncPlanSubscription({ ...fx.planSubscriptionActive, status: "past_due" } as typeof fx.planSubscriptionActive);
    expect(db.contractPlan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ status: "past_due" }) }),
    );
  });
});
