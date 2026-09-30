// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The monthly plan was discarded (round 2, 2026-09-29): the plan checkout
 * and the agent subscription answer 410 with a plain message, in every
 * billing posture, and never reach Stripe.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ agentApi: true, stripeEnabled: true }));
vi.mock("@/config/features", () => ({ features: flags }));

const stripe = vi.hoisted(() => ({
  createBillingCheckout: vi.fn(),
  getOrCreateStripeCustomer: vi.fn(),
  getStripe: vi.fn(),
}));
vi.mock("@/lib/stripe", () => stripe);

import { POST as planCheckout } from "@/app/api/checkout/route";
import { POST as agentSubscribe } from "@/app/api/v1/agent/subscribe/route";
import { POST as legacyCreditsPath } from "@/app/api/checkout/credits/route";

afterEach(() => {
  flags.agentApi = true;
  flags.stripeEnabled = true;
  vi.clearAllMocks();
});

function expectNoStripe() {
  expect(stripe.createBillingCheckout).not.toHaveBeenCalled();
  expect(stripe.getOrCreateStripeCustomer).not.toHaveBeenCalled();
  expect(stripe.getStripe).not.toHaveBeenCalled();
}

describe("retired plan checkout: POST /api/checkout", () => {
  it.each([true, false])("answers 410 with a plain message (Stripe on: %s)", async (on) => {
    flags.stripeEnabled = on;
    const res = await planCheckout();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.code).toBe("GONE");
    expect(body.error).toMatch(/no longer offered/);
    expect(body.error).toMatch(/each contract is paid once/);
    expectNoStripe();
  });
});

describe("retired agent subscription: POST /api/v1/agent/subscribe", () => {
  it.each([true, false])("answers 410 and points to credits (Stripe on: %s)", async (on) => {
    flags.stripeEnabled = on;
    const res = await agentSubscribe();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.code).toBe("GONE");
    expect(body.error).toMatch(/no longer offered/);
    expect(body.buyCredits).toEqual({ method: "POST", url: "/api/v1/agent/credits/checkout" });
    expectNoStripe();
  });

  it("the backward-compatible path answers the same", async () => {
    expect((await legacyCreditsPath()).status).toBe(410);
  });

  it("stays 404 where the agent API is off", async () => {
    flags.agentApi = false;
    expect((await agentSubscribe()).status).toBe(404);
  });
});
