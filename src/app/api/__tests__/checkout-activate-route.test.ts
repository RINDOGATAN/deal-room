// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * POST /api/checkout/activate (the return from Stripe Checkout): a session
 * a promotion code took to zero ("no_payment_required") grants exactly like
 * a paid one; an unpaid one is refused. The grant itself is the same
 * idempotent fulfilment the webhook runs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type Stripe from "stripe";
import * as fx from "@/server/services/billing/__tests__/fixtures/stripe-events";

vi.mock("@/config/features", () => ({ features: { stripeEnabled: true } }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const db = vi.hoisted(() => ({ customer: { findUnique: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));

const nextAuth = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => nextAuth);

const retrieve = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { retrieve } } }),
  getSubscription: vi.fn(),
}));

const events = vi.hoisted(() => ({ fulfilCheckoutSession: vi.fn(async () => true) }));
vi.mock("@/server/services/billing/stripe-events", async (orig) => ({
  ...(await orig<typeof import("@/server/services/billing/stripe-events")>()),
  fulfilCheckoutSession: events.fulfilCheckoutSession,
}));

import { POST } from "@/app/api/checkout/activate/route";

function req(sessionId: string) {
  return new NextRequest("https://dealroom.test/api/checkout/activate", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

function returning(session: Stripe.Checkout.Session) {
  retrieve.mockResolvedValue(session);
  db.customer.findUnique.mockResolvedValue({ id: session.metadata?.customerId, email: "tester@example.test" });
}

beforeEach(() => {
  nextAuth.getServerSession.mockResolvedValue({ user: { email: "tester@example.test" } });
});

afterEach(() => vi.clearAllMocks());

describe("checkout activation", () => {
  it("grants a credit pack checkout discounted to zero", async () => {
    returning(fx.creditsSessionFree);
    const res = await POST(req("cs_test_credits_free"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ activated: true, kind: "credits" });
    expect(events.fulfilCheckoutSession).toHaveBeenCalledWith(fx.creditsSessionFree);
  });

  it("unlocks a contract checkout discounted to zero", async () => {
    returning(fx.contractSessionFree);
    const res = await POST(req("cs_test_contract_free"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ activated: true, kind: "contract", dealRoomId: "deal_1" });
    expect(events.fulfilCheckoutSession).toHaveBeenCalledWith(fx.contractSessionFree);
  });

  it("still grants a paid checkout", async () => {
    returning(fx.contractSessionPaid);
    expect((await POST(req("cs_test_contract_1"))).status).toBe(200);
    expect(events.fulfilCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("refuses a checkout whose payment has not arrived", async () => {
    returning(fx.contractSessionUnpaid);
    const res = await POST(req("cs_test_contract_async"));
    expect(res.status).toBe(400);
    expect(events.fulfilCheckoutSession).not.toHaveBeenCalled();
  });
});
