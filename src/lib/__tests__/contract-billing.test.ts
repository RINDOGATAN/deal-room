// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import {
  CONTRACT_BILLING_ENV_KEYS,
  CONTRACT_PRICE_ENV_KEYS,
  billingStartDate,
  chooseCurrency,
  preferredCurrency,
  contractBillingConfigured,
  dealPredatesBilling,
  displayPrice,
  formatAmount,
  priceIdFor,
} from "@/lib/contract-billing";

const FOUR = Object.fromEntries(CONTRACT_PRICE_ENV_KEYS.map((k) => [k, `price_${k.toLowerCase()}`]));
const FIVE = { ...FOUR, CONTRACT_BILLING_START: "2026-10-01" };

describe("the hosted billing switch: four prices and the start date", () => {
  it("names exactly the four price variables (no monthly plan)", () => {
    expect([...CONTRACT_PRICE_ENV_KEYS].sort()).toEqual([
      "STRIPE_PRICE_CONTRACT_EUR",
      "STRIPE_PRICE_CONTRACT_USD",
      "STRIPE_PRICE_CREDITS_10_EUR",
      "STRIPE_PRICE_CREDITS_10_USD",
    ]);
  });

  it("requires the start date as the fifth variable", () => {
    expect([...CONTRACT_BILLING_ENV_KEYS].sort()).toEqual([
      "CONTRACT_BILLING_START",
      "STRIPE_PRICE_CONTRACT_EUR",
      "STRIPE_PRICE_CONTRACT_USD",
      "STRIPE_PRICE_CREDITS_10_EUR",
      "STRIPE_PRICE_CREDITS_10_USD",
    ]);
  });

  it("is ready only with all five set, the start being a real date", () => {
    expect(contractBillingConfigured(FIVE)).toBe(true);
    expect(contractBillingConfigured(FOUR)).toBe(false);
    expect(contractBillingConfigured({ ...FIVE, CONTRACT_BILLING_START: "not a date" })).toBe(false);
    expect(contractBillingConfigured({ ...FIVE, STRIPE_PRICE_CREDITS_10_USD: " " })).toBe(false);
    expect(contractBillingConfigured({})).toBe(false);
  });

  it("no longer reads the monthly variables", () => {
    const withMonthlyOnly = {
      ...FIVE,
      STRIPE_PRICE_CONTRACT_EUR: "",
      STRIPE_PRICE_MONTHLY_USD: "price_m_usd",
      STRIPE_PRICE_MONTHLY_EUR: "price_m_eur",
    };
    expect(contractBillingConfigured(withMonthlyOnly)).toBe(false);
  });

  it("reads price ids from the environment, never from code", () => {
    expect(priceIdFor("contract", "eur", FOUR)).toBe("price_stripe_price_contract_eur");
    expect(priceIdFor("credits10", "usd", {})).toBeNull();
  });
});

describe("the billing start date", () => {
  const start = { CONTRACT_BILLING_START: "2026-10-01" };
  const before = new Date("2026-09-30T23:59:00Z");
  const after = new Date("2026-10-02T00:00:00Z");

  it("parses the start date or gives null", () => {
    expect(billingStartDate(start)?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(billingStartDate({})).toBeNull();
    expect(billingStartDate({ CONTRACT_BILLING_START: "soon" })).toBeNull();
  });

  it("never charges a deal from before the start; charges one from after it", () => {
    expect(dealPredatesBilling({ status: "AGREED", createdAt: before, hasSigningRequest: false }, start)).toBe(true);
    expect(dealPredatesBilling({ status: "AGREED", createdAt: after, hasSigningRequest: false }, start)).toBe(false);
  });

  it("never charges a deal already in signature or completed", () => {
    expect(dealPredatesBilling({ status: "COMPLETED", createdAt: after, hasSigningRequest: false }, start)).toBe(true);
    expect(dealPredatesBilling({ status: "SIGNING", createdAt: after, hasSigningRequest: false }, start)).toBe(true);
    expect(dealPredatesBilling({ status: "AGREED", createdAt: after, hasSigningRequest: true }, start)).toBe(true);
  });

  it("charges nothing when the start date is missing or not a date", () => {
    expect(dealPredatesBilling({ status: "AGREED", createdAt: after, hasSigningRequest: false }, {})).toBe(true);
    expect(
      dealPredatesBilling(
        { status: "AGREED", createdAt: after, hasSigningRequest: false },
        { CONTRACT_BILLING_START: "not a date" },
      ),
    ).toBe(true);
  });
});

describe("currency and display", () => {
  it("chooses the currency: request, then stored preference, then the region fallback", () => {
    expect(chooseCurrency({ requested: "usd", stored: "eur", fallback: "eur" })).toBe("usd");
    expect(chooseCurrency({ requested: "gbp", stored: "eur", fallback: "usd" })).toBe("eur");
    expect(chooseCurrency({ fallback: "eur" })).toBe("eur");
    expect(chooseCurrency({ fallback: "usd" })).toBe("usd");
    expect(chooseCurrency({})).toBe("usd");
  });

  it("reads the stored billing currency from the customer metadata", () => {
    expect(preferredCurrency({ preferredCurrency: "eur" })).toBe("eur");
    expect(preferredCurrency({})).toBeUndefined();
    expect(preferredCurrency(null)).toBeUndefined();
    expect(preferredCurrency(["eur"])).toBeUndefined();
  });

  it("formats display amounts without hard-coded prices", () => {
    expect(formatAmount(2900, "eur")).toBe("€29");
    expect(formatAmount(2900, "usd")).toBe("$29");
    expect(formatAmount(950, "usd")).toBe("$9.50");
    expect(formatAmount(2900, "eur", "es")).toMatch(/29\s?€/);
  });

  it("shows PRICE_DISPLAY_* first, then the Stripe amount, else nothing", () => {
    const env = { PRICE_DISPLAY_CONTRACT: "29", PRICE_DISPLAY_CREDITS_10: "217.50" };
    expect(displayPrice("contract", "usd", { env })).toBe("$29");
    expect(displayPrice("credits10", "eur", { env })).toBe("€217.50");
    expect(displayPrice("contract", "usd", { env, stripeMinor: 9900 })).toBe("$29");
    expect(displayPrice("contract", "usd", { env: { PRICE_DISPLAY_CONTRACT: "From $29" } })).toBe("From $29");
    expect(displayPrice("contract", "usd", { env: {}, stripeMinor: 2900 })).toBe("$29");
    expect(displayPrice("contract", "usd", { env: {} })).toBeNull();
  });
});
