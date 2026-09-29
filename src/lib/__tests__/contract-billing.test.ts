// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import {
  CONTRACT_PRICE_ENV_KEYS,
  chooseCurrency,
  contractPricesConfigured,
  dealPredatesBilling,
  formatAmount,
  planCoversContracts,
  priceIdFor,
} from "@/lib/contract-billing";

const SIX = Object.fromEntries(CONTRACT_PRICE_ENV_KEYS.map((k) => [k, `price_${k.toLowerCase()}`]));

describe("contract billing rules", () => {
  it("names exactly the six price variables", () => {
    expect([...CONTRACT_PRICE_ENV_KEYS].sort()).toEqual(
      [
        "STRIPE_PRICE_CONTRACT_EUR",
        "STRIPE_PRICE_CONTRACT_USD",
        "STRIPE_PRICE_CREDITS_10_EUR",
        "STRIPE_PRICE_CREDITS_10_USD",
        "STRIPE_PRICE_MONTHLY_EUR",
        "STRIPE_PRICE_MONTHLY_USD",
      ],
    );
  });

  it("is ready only with all six prices set", () => {
    expect(contractPricesConfigured(SIX)).toBe(true);
    expect(contractPricesConfigured({ ...SIX, STRIPE_PRICE_CREDITS_10_USD: " " })).toBe(false);
    expect(contractPricesConfigured({})).toBe(false);
  });

  it("reads price ids from the environment, never from code", () => {
    expect(priceIdFor("contract", "eur", SIX)).toBe("price_stripe_price_contract_eur");
    expect(priceIdFor("monthly", "usd", {})).toBeNull();
  });

  it("chooses the currency: request, then stored preference, then language", () => {
    expect(chooseCurrency({ requested: "usd", stored: "eur", locale: "es" })).toBe("usd");
    expect(chooseCurrency({ requested: "gbp", stored: "eur", locale: "en" })).toBe("eur");
    expect(chooseCurrency({ locale: "es" })).toBe("eur");
    expect(chooseCurrency({ locale: "en" })).toBe("usd");
    expect(chooseCurrency({})).toBe("usd");
  });

  it("lets the monthly plan cover contracts only while active and in period", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    const later = new Date("2026-11-01T00:00:00Z");
    const earlier = new Date("2026-10-01T00:00:00Z");
    expect(planCoversContracts("active", later, now)).toBe(true);
    expect(planCoversContracts("trialing", null, now)).toBe(true);
    expect(planCoversContracts("active", earlier, now)).toBe(false);
    expect(planCoversContracts("past_due", later, now)).toBe(false);
    expect(planCoversContracts("canceled", later, now)).toBe(false);
  });

  it("does not charge deals that reached signature before billing", () => {
    const createdAt = new Date("2026-09-01T00:00:00Z");
    expect(dealPredatesBilling({ status: "COMPLETED", createdAt, hasSigningRequest: false }, {})).toBe(true);
    expect(dealPredatesBilling({ status: "AGREED", createdAt, hasSigningRequest: true }, {})).toBe(true);
    expect(dealPredatesBilling({ status: "AGREED", createdAt, hasSigningRequest: false }, {})).toBe(false);
    expect(
      dealPredatesBilling(
        { status: "AGREED", createdAt, hasSigningRequest: false },
        { CONTRACT_BILLING_START: "2026-10-15" },
      ),
    ).toBe(true);
    expect(
      dealPredatesBilling(
        { status: "AGREED", createdAt, hasSigningRequest: false },
        { CONTRACT_BILLING_START: "not a date" },
      ),
    ).toBe(false);
  });

  it("formats display amounts without hard-coded prices", () => {
    expect(formatAmount(2900, "eur")).toBe("€29");
    expect(formatAmount(2900, "usd")).toBe("$29");
    expect(formatAmount(950, "usd")).toBe("$9.50");
    expect(formatAmount(2900, "eur", "es")).toMatch(/29\s?€/);
  });
});
