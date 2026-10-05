// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * POST /api/billing/credits ("Buy credits" on Settings, API keys): the same
 * pack the agent buys, for the signed-in person's own customer, no key
 * needed; off where self-service keys are off.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const flags = vi.hoisted(() => ({ selfServiceApiKeys: true }));
vi.mock("@/config/features", () => ({ features: flags }));
vi.mock("@/lib/prisma", () => ({ prisma: {}, default: {} }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const nextAuth = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => nextAuth);

const stripe = vi.hoisted(() => ({
  createBillingCheckout: vi.fn(async () => ({ url: "https://checkout.stripe.test/c/2" })),
  getOrCreateStripeCustomer: vi.fn(async () => ({ customerId: "cust_alice", stripeCustomerId: "cus_alice" })),
}));
vi.mock("@/lib/stripe", () => stripe);

const limits = vi.hoisted(() => ({
  checkPublicRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9 })),
  tooManyRequests: vi.fn(() => new Response(null, { status: 429 })),
}));
vi.mock("@/server/middleware/public-rate-limit", () => limits);

vi.mock("@/server/services/billing/checkout", () => ({
  appBaseUrl: () => "https://dealroom.test",
  localeFromRequest: () => "en",
  currencyForCustomer: vi.fn(async (_id: string, requested: unknown) => (requested === "eur" ? "eur" : "usd")),
}));

import { POST } from "@/app/api/billing/credits/route";

function req(body: unknown = {}) {
  return new NextRequest("https://dealroom.test/api/billing/credits", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  flags.selfServiceApiKeys = true;
  vi.stubEnv("STRIPE_PRICE_CREDITS_10_USD", "price_pack_usd");
  vi.stubEnv("STRIPE_PRICE_CREDITS_10_EUR", "price_pack_eur");
  nextAuth.getServerSession.mockResolvedValue({
    user: { id: "user-alice", email: "alice@example.test", name: "Alice" },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("person credit checkout", () => {
  it("opens one pack for the signed-in person's customer and returns to API keys", async () => {
    const res = await POST(req({ currency: "eur" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.test/c/2", credits: 10, currency: "eur" });
    expect(stripe.getOrCreateStripeCustomer).toHaveBeenCalledWith({}, "alice@example.test", "Alice");
    expect(stripe.createBillingCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: "price_pack_eur",
        metadata: { kind: "credits", customerId: "cust_alice", userId: "user-alice", credits: "10" },
        successUrl: "https://dealroom.test/settings/api-keys?credits=added",
        cancelUrl: "https://dealroom.test/settings/api-keys",
      }),
    );
  });

  it("needs a signed-in person", async () => {
    nextAuth.getServerSession.mockResolvedValue(null);
    expect((await POST(req())).status).toBe(401);
    expect(stripe.createBillingCheckout).not.toHaveBeenCalled();
  });

  it("answers 409 where self-service keys and billing are off", async () => {
    flags.selfServiceApiKeys = false;
    expect((await POST(req())).status).toBe(409);
  });

  it("is rate limited per person", async () => {
    limits.checkPublicRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 });
    expect((await POST(req())).status).toBe(429);
    expect(limits.checkPublicRateLimit).toHaveBeenCalledWith("credits-checkout", "user-alice");
  });

  it("answers 503 when the pack price is missing", async () => {
    vi.stubEnv("STRIPE_PRICE_CREDITS_10_USD", "");
    expect((await POST(req())).status).toBe(503);
  });
});
