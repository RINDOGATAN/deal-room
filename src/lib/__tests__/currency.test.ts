// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Storefront currency rule: dollars unless the visitor is known to be
 * outside the US; euros only for a known non-US visitor.
 */
import { describe, it, expect } from "vitest";
import { currencyForCountry, currencyFromCookieHeader, formatPrice } from "@/lib/currency";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

describe("currencyForCountry", () => {
  it("gives dollars to a US visitor and to an unknown one", () => {
    expect(currencyForCountry("US")).toBe("USD");
    expect(currencyForCountry("")).toBe("USD");
    expect(currencyForCountry(null)).toBe("USD");
  });

  it("gives euros only to a visitor known to be outside the US", () => {
    expect(currencyForCountry("ES")).toBe("EUR");
    expect(currencyForCountry("gb")).toBe("EUR");
  });
});

describe("currencyFromCookieHeader", () => {
  it("reads euros only when the cookie says so", () => {
    expect(currencyFromCookieHeader("locale=es; currency=EUR")).toBe("EUR");
    expect(currencyFromCookieHeader("currency=USD")).toBe("USD");
    expect(currencyFromCookieHeader("")).toBe("USD");
    expect(currencyFromCookieHeader(undefined)).toBe("USD");
  });

  it("formats with the matching symbol", () => {
    expect(formatPrice(60, "USD")).toBe("$60");
    expect(formatPrice(60, "EUR")).toBe("€60");
  });
});

describe("kit price copy", () => {
  it("is a pair of strings in both languages", () => {
    expect(en.pilot.kitPriceUSD).toBe("$60");
    expect(en.pilot.kitPriceEUR).toBe("€60");
    expect(es.pilot.kitPriceUSD).toBe("60 $");
    expect(es.pilot.kitPriceEUR).toBe("60 €");
  });

  it("leaves no fixed euro figure in the interface copy", () => {
    for (const messages of [en, es]) {
      const { kitPriceEUR: _eur, ...pilot } = messages.pilot;
      expect(JSON.stringify({ ...messages, pilot })).not.toMatch(/€60|60 €/);
    }
  });
});
