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
    deletedDealPayment: { updateMany: vi.fn() },
    customerCredit: { upsert: vi.fn(), update: vi.fn() },
    customerCreditEntry: { create: vi.fn(), findFirst: vi.fn() },
    // Round-1 tables: must never be touched any more.
    agentCredit: { upsert: vi.fn(), update: vi.fn() },
    agentCreditEntry: { create: vi.fn(), findFirst: vi.fn() },
    contractPlan: { upsert: vi.fn() },
    revenueEvent: { create: vi.fn(), updateMany: vi.fn() },
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
  isCheckoutSettled,
  discountNoteOf,
} from "../stripe-events";

const unique = () => new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "5" });

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  db.dealPayment.updateMany.mockResolvedValue({ count: 1 });
  db.deletedDealPayment.updateMany.mockResolvedValue({ count: 0 });
  db.customerCreditEntry.findFirst.mockResolvedValue(null);
});

function expectNoRound1OrRevenueWrites() {
  expect(db.agentCredit.upsert).not.toHaveBeenCalled();
  expect(db.agentCredit.update).not.toHaveBeenCalled();
  expect(db.agentCreditEntry.create).not.toHaveBeenCalled();
  expect(db.contractPlan.upsert).not.toHaveBeenCalled();
  expect(db.revenueEvent.create).not.toHaveBeenCalled();
}

describe("checkout.session.completed", () => {
  it("marks the deal paid for a paid contract checkout, with no revenue share", async () => {
    expect(await fulfilCheckoutSession(fx.contractSessionPaid)).toBe(true);
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
    expectNoRound1OrRevenueWrites();
  });

  it("does not unlock a checkout whose payment is still pending", async () => {
    await fulfilCheckoutSession(fx.contractSessionUnpaid);
    expect(db.dealPayment.upsert).not.toHaveBeenCalled();
  });

  it("adds ten credits to the customer, noting the key that bought them", async () => {
    await fulfilCheckoutSession(fx.creditsSessionPaid);
    expect(db.customerCredit.upsert).toHaveBeenCalledWith({
      where: { customerId: "cust_2" },
      update: {},
      create: { customerId: "cust_2", balance: 0 },
    });
    expect(db.customerCreditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: "cust_2",
        apiKeyId: "key_1",
        delta: 10,
        reason: "PURCHASE",
        stripeCheckoutSessionId: "cs_test_credits_1",
      }),
    });
    expect(db.customerCredit.update).toHaveBeenCalledWith({
      where: { customerId: "cust_2" },
      data: { balance: { increment: 10 } },
    });
    expectNoRound1OrRevenueWrites();
  });

  it("credits the customer even when the session names no key", async () => {
    const noKey = {
      ...fx.creditsSessionPaid,
      metadata: { kind: "credits", customerId: "cust_2", credits: "10" },
    } as typeof fx.creditsSessionPaid;
    await fulfilCheckoutSession(noKey);
    expect(db.customerCreditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ customerId: "cust_2", apiKeyId: null, delta: 10 }),
    });
  });

  it("credits a pack only once when the event is delivered again", async () => {
    db.customerCreditEntry.create.mockRejectedValueOnce(unique());
    await expect(fulfilCheckoutSession(fx.creditsSessionPaid)).resolves.toBe(true);
    // The balance update sits after the failed insert in the same transaction.
    expect(db.customerCredit.update).not.toHaveBeenCalled();
  });

  it("no longer knows the discarded monthly plan", async () => {
    expect(billingKindOf(fx.planSessionComplete.metadata)).toBeNull();
    expect(await fulfilCheckoutSession(fx.planSessionComplete)).toBe(false);
    expectNoRound1OrRevenueWrites();
  });

  it("leaves legacy per-skill sessions to the old handler", async () => {
    expect(billingKindOf(fx.legacySkillSession.metadata)).toBeNull();
    expect(await fulfilCheckoutSession(fx.legacySkillSession)).toBe(false);
    expect(db.dealPayment.upsert).not.toHaveBeenCalled();
  });
});

describe("checkouts a promotion code took to zero (no_payment_required)", () => {
  it("counts as settled, like paid; unpaid still does not", () => {
    expect(isCheckoutSettled(fx.contractSessionPaid)).toBe(true);
    expect(isCheckoutSettled(fx.contractSessionFree)).toBe(true);
    expect(isCheckoutSettled(fx.contractSessionUnpaid)).toBe(false);
  });

  it("unlocks the contract, recording the amount actually charged (0)", async () => {
    expect(await fulfilCheckoutSession(fx.contractSessionFree)).toBe(true);
    expect(db.dealPayment.upsert).toHaveBeenCalledWith({
      where: { stripeCheckoutSessionId: "cs_test_contract_free" },
      update: { stripePaymentIntentId: null },
      create: expect.objectContaining({
        dealRoomId: "deal_1",
        kind: "CONTRACT",
        status: "PAID",
        amount: 0,
        stripePaymentIntentId: null,
      }),
    });
    expectNoRound1OrRevenueWrites();
  });

  it("adds the pack and notes the promotion code on the ledger entry", async () => {
    expect(await fulfilCheckoutSession(fx.creditsSessionFree)).toBe(true);
    expect(db.customerCreditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: "cust_2",
        delta: 10,
        reason: "PURCHASE",
        stripeCheckoutSessionId: "cs_test_credits_free",
        stripePaymentIntentId: null,
        note: "discount promotion_code=promo_test_free coupon=cpn_test_free amount_discount=21750 amount_total=0",
      }),
    });
    expect(db.customerCredit.update).toHaveBeenCalledWith({
      where: { customerId: "cust_2" },
      data: { balance: { increment: 10 } },
    });
    expectNoRound1OrRevenueWrites();
  });

  it("leaves the note empty on an undiscounted purchase", async () => {
    expect(discountNoteOf(fx.creditsSessionPaid)).toBeNull();
    await fulfilCheckoutSession(fx.creditsSessionPaid);
    expect(db.customerCreditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ note: null }),
    });
  });

  it("reads expanded discount objects too", () => {
    const expanded = {
      ...fx.creditsSessionFree,
      discounts: [{ coupon: { id: "cpn_x" }, promotion_code: { id: "promo_x" } }],
    } as unknown as typeof fx.creditsSessionFree;
    expect(discountNoteOf(expanded)).toContain("promotion_code=promo_x coupon=cpn_x");
  });

  it("credits a free pack only once when the event is replayed", async () => {
    await fulfilCheckoutSession(fx.creditsSessionFree);
    db.customerCreditEntry.create.mockRejectedValueOnce(unique());
    await expect(fulfilCheckoutSession(fx.creditsSessionFree)).resolves.toBe(true);
    expect(db.customerCreditEntry.create).toHaveBeenCalledTimes(2);
    expect(db.customerCredit.update).toHaveBeenCalledTimes(1);
  });

  it("upserts a replayed free contract on the session id, never a second row", async () => {
    await fulfilCheckoutSession(fx.contractSessionFree);
    await fulfilCheckoutSession(fx.contractSessionFree);
    expect(db.dealPayment.upsert).toHaveBeenCalledTimes(2);
    for (const [arg] of db.dealPayment.upsert.mock.calls) {
      expect(arg.where).toEqual({ stripeCheckoutSessionId: "cs_test_contract_free" });
      // A replay never re-marks the row PAID (a revoked one stays revoked).
      expect(arg.update).toEqual({ stripePaymentIntentId: null });
    }
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

  it("also marks the kept billing record of a deleted deal refunded", async () => {
    await handleChargeRefunded(fx.chargeFullyRefunded);
    expect(db.deletedDealPayment.updateMany).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: "pi_test_contract_1", kind: "CONTRACT", status: "PAID" },
      data: expect.objectContaining({ status: "REVOKED", revokedReason: "refunded" }),
    });
  });

  it("keeps the entitlement on a partial refund", async () => {
    await handleChargeRefunded(fx.chargePartiallyRefunded);
    expect(db.dealPayment.updateMany).not.toHaveBeenCalled();
    expect(db.customerCreditEntry.create).not.toHaveBeenCalled();
  });

  it("takes a refunded credit pack back from the customer", async () => {
    db.customerCreditEntry.findFirst.mockResolvedValue({
      customerId: "cust_2",
      apiKeyId: "key_1",
      delta: 10,
      stripeCheckoutSessionId: "cs_test_credits_1",
      stripePaymentIntentId: "pi_test_credits_1",
    });
    await handleChargeRefunded(fx.creditsChargeRefunded);
    expect(db.customerCreditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ customerId: "cust_2", delta: -10, reason: "REVERSAL" }),
    });
    expect(db.customerCredit.update).toHaveBeenCalledWith({
      where: { customerId: "cust_2" },
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
});
