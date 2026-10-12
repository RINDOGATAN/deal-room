// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One currency per visitor: euros in the 27 EU member states, dollars
 * everywhere else. Country header first, then the Accept-Language region
 * (same EU list), then dollars; a stored billing currency wins; Spanish
 * pages always show euros. There is no switch.
 */
import { describe, it, expect } from "vitest";
import {
  EUROPE_COUNTRIES,
  currencyForCountry,
  currencyFromCookieHeader,
  displayCurrency,
  formatPrice,
  regionCurrency,
  regionFromAcceptLanguage,
  resolveVisitorCurrency,
  resolveVisitorCurrencyFromHeaders,
} from "@/lib/currency";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

describe("currencyForCountry", () => {
  it("gives euros to the EU member states", () => {
    for (const code of ["DE", "ES", "IE", "de", "FR", "GR", "EL", "HR", "CY", "MT", "SE", "BG"]) {
      expect(currencyForCountry(code)).toBe("EUR");
    }
  });

  it("gives dollars to the UK, Switzerland, the EEA outside the EU, and everyone else", () => {
    for (const code of [
      "GB", "UK", "CH", "NO", "IS", "LI",
      "AD", "MC", "SM", "VA", "GI", "JE", "GG", "IM", "ME", "XK",
      "US", "CA", "MX", "BR", "AR", "JP", "IN", "AU", "TR", "RU", "UA", "MA", "", null,
    ]) {
      expect(currencyForCountry(code)).toBe("USD");
    }
  });

  it("lists exactly the 27 EU members plus the EL alias for Greece", () => {
    expect(EUROPE_COUNTRIES.size).toBe(27 + 1);
    for (const c of ["GB", "CH", "NO", "IS", "LI"]) expect(EUROPE_COUNTRIES.has(c)).toBe(false);
  });
});

describe("regionFromAcceptLanguage", () => {
  it("takes the region of the most preferred tag that has one", () => {
    expect(regionFromAcceptLanguage("es-ES,es;q=0.9,en;q=0.8")).toBe("ES");
    expect(regionFromAcceptLanguage("es,en-GB;q=0.8")).toBe("GB");
    expect(regionFromAcceptLanguage("en-US;q=0.5,fr-FR;q=0.9")).toBe("FR");
    expect(regionFromAcceptLanguage("zh-Hant-TW")).toBe("TW");
  });

  it("finds none in bare languages or numeric regions", () => {
    expect(regionFromAcceptLanguage("es")).toBeNull();
    expect(regionFromAcceptLanguage("es-419,en")).toBeNull();
    expect(regionFromAcceptLanguage("")).toBeNull();
    expect(regionFromAcceptLanguage(null)).toBeNull();
  });
});

describe("regionCurrency", () => {
  it("uses the country header first", () => {
    expect(regionCurrency({ country: "US", acceptLanguage: "es-ES" })).toBe("USD");
    expect(regionCurrency({ country: "ES", acceptLanguage: "en-US" })).toBe("EUR");
  });

  it("gives dollars for GB, CH, NO, MX, BR and US headers", () => {
    for (const country of ["GB", "CH", "NO", "MX", "BR", "US"]) {
      expect(regionCurrency({ country, acceptLanguage: "de-DE" })).toBe("USD");
    }
  });

  it("falls back to the Accept-Language region (EU list), then to dollars", () => {
    expect(regionCurrency({ acceptLanguage: "de-DE,de" })).toBe("EUR");
    expect(regionCurrency({ acceptLanguage: "en-IE" })).toBe("EUR");
    expect(regionCurrency({ acceptLanguage: "en-GB,en" })).toBe("USD");
    expect(regionCurrency({ acceptLanguage: "de-CH" })).toBe("USD");
    expect(regionCurrency({ acceptLanguage: "nb-NO" })).toBe("USD");
    expect(regionCurrency({ acceptLanguage: "es-MX" })).toBe("USD");
    expect(regionCurrency({ acceptLanguage: "es" })).toBe("USD");
    expect(regionCurrency({})).toBe("USD");
  });
});

describe("resolveVisitorCurrency", () => {
  it("prefers the stored billing currency, then the region", () => {
    expect(resolveVisitorCurrency({ stored: "eur", country: "US" })).toBe("EUR");
    expect(resolveVisitorCurrency({ stored: "usd", country: "ES" })).toBe("USD");
    expect(resolveVisitorCurrency({ stored: "gbp", country: "ES" })).toBe("EUR");
    expect(resolveVisitorCurrency({ country: "BR" })).toBe("USD");
  });

  it("reads the request headers", () => {
    const headers = new Headers({ "x-vercel-ip-country": "CH", "accept-language": "en-US" });
    expect(resolveVisitorCurrencyFromHeaders(headers)).toBe("USD");
    expect(resolveVisitorCurrencyFromHeaders(new Headers({ "x-vercel-ip-country": "IE" }))).toBe("EUR");
    expect(resolveVisitorCurrencyFromHeaders(new Headers({ "x-vercel-ip-country": "GB" }))).toBe("USD");
    expect(resolveVisitorCurrencyFromHeaders(new Headers({ "x-vercel-ip-country": "GB" }), "eur")).toBe("EUR");
    expect(resolveVisitorCurrencyFromHeaders(new Headers({ "accept-language": "fr-FR" }))).toBe("EUR");
  });
});

describe("displayCurrency", () => {
  it("shows euros on every Spanish page, whatever the visitor's currency", () => {
    expect(displayCurrency("es", "USD")).toBe("EUR");
    expect(displayCurrency("es", "EUR")).toBe("EUR");
    expect(displayCurrency("en", "USD")).toBe("USD");
    expect(displayCurrency("en", "EUR")).toBe("EUR");
  });
});

describe("cookies", () => {
  it("reads the region guess, else dollars; a leftover switch cookie is ignored", () => {
    expect(currencyFromCookieHeader("locale=es; currency=EUR")).toBe("EUR");
    expect(currencyFromCookieHeader("currency=EUR; currency_choice=USD")).toBe("EUR");
    expect(currencyFromCookieHeader("currency=USD")).toBe("USD");
    expect(currencyFromCookieHeader("")).toBe("USD");
    expect(currencyFromCookieHeader(undefined)).toBe("USD");
  });

  it("ignores a leftover switch cookie on the server too", () => {
    const headers = new Headers({ cookie: "currency_choice=USD", "x-vercel-ip-country": "ES" });
    expect(resolveVisitorCurrencyFromHeaders(headers)).toBe("EUR");
  });

  it("formats with the matching symbol", () => {
    expect(formatPrice(60, "USD")).toBe("$60");
    expect(formatPrice(60, "EUR")).toBe("€60");
  });
});

describe("no currency switch", () => {
  it("has no switch strings in either language", () => {
    expect((en as Record<string, unknown>).currency).toBeUndefined();
    expect((es as Record<string, unknown>).currency).toBeUndefined();
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
