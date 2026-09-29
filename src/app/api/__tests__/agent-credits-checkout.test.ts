// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * POST /api/v1/agent/credits/checkout: a pack of ten, priced from the
 * environment, credited to the key's customer (the key is noted only).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const flags = vi.hoisted(() => ({ agentApi: true, stripeEnabled: true }));
vi.mock("@/config/features", () => ({ features: flags }));
vi.mock("@/lib/prisma", () => ({ prisma: {}, default: {} }));

const stripe = vi.hoisted(() => ({
  createBillingCheckout: vi.fn(async () => ({ url: "https://checkout.stripe.test/c/1" })),
  getOrCreateStripeCustomer: vi.fn(async () => ({ customerId: "cust_1", stripeCustomerId: "cus_1" })),
}));
vi.mock("@/lib/stripe", () => stripe);

const auth = vi.hoisted(() => ({
  authenticateApiKey: vi.fn(),
  requireScope: vi.fn(),
  ApiScopeError: class extends Error {},
}));
vi.mock("@/server/middleware/apiKeyAuth", () => auth);

import { POST } from "@/app/api/v1/agent/credits/checkout/route";

function req(body: unknown = {}) {
  return new NextRequest("https://dealroom.test/api/v1/agent/credits/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  flags.stripeEnabled = true;
  vi.stubEnv("STRIPE_PRICE_CREDITS_10_USD", "price_pack_usd");
  vi.stubEnv("STRIPE_PRICE_CREDITS_10_EUR", "price_pack_eur");
  vi.stubEnv("NEXTAUTH_URL", "https://dealroom.test");
  auth.authenticateApiKey.mockResolvedValue({
    customer: { id: "cust_1", email: "agent@example.com", name: "Agent Co" },
    apiKey: { id: "key_1", name: "k", scopes: ["billing:read"] },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("agent credit checkout", () => {
  it("opens a one-off checkout for one pack, owned by the key's customer", async () => {
    // Even if the e-mail lookup found another customer row, the credits go
    // to the customer that owns the key.
    stripe.getOrCreateStripeCustomer.mockResolvedValueOnce({ customerId: "cust_other", stripeCustomerId: "cus_1" });
    const res = await POST(req({ currency: "eur" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      checkoutUrl: "https://checkout.stripe.test/c/1",
      credits: 10,
      currency: "eur",
    });
    expect(stripe.createBillingCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        priceId: "price_pack_eur",
        metadata: { kind: "credits", customerId: "cust_1", apiKeyId: "key_1", credits: "10" },
      }),
    );
  });

  it("defaults to dollars", async () => {
    await POST(req());
    expect(stripe.createBillingCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: "price_pack_usd" }),
    );
  });

  it("answers 409 when payments are off", async () => {
    flags.stripeEnabled = false;
    expect((await POST(req())).status).toBe(409);
  });

  it("needs a key", async () => {
    auth.authenticateApiKey.mockResolvedValue(null);
    expect((await POST(req())).status).toBe(401);
  });

  it("answers 503 when the pack price is missing", async () => {
    vi.stubEnv("STRIPE_PRICE_CREDITS_10_USD", "");
    expect((await POST(req())).status).toBe(503);
  });
});
