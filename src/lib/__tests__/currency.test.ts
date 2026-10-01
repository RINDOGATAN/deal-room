// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One currency per visitor: euros in Europe (EU, EEA, United Kingdom,
 * Switzerland), dollars elsewhere. Country header first, then the
 * Accept-Language region, then dollars; the visitor's switch choice wins,
 * then a stored billing currency.
 */
import { describe, it, expect } from "vitest";
import {
  EUROPE_COUNTRIES,
  choiceFromCookieHeader,
  currencyForCountry,
  currencyFromCookieHeader,
  formatPrice,
  regionCurrency,
  regionFromAcceptLanguage,
  resolveVisitorCurrency,
  resolveVisitorCurrencyFromHeaders,
} from "@/lib/currency";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

describe("currencyForCountry", () => {
  it("gives euros to the EU, the EEA, the United Kingdom and Switzerland", () => {
    for (const code of ["ES", "de", "FR", "IE", "GR", "NO", "IS", "LI", "GB", "CH"]) {
      expect(currencyForCountry(code)).toBe("EUR");
    }
  });

  it("gives dollars to everyone else and to an unknown visitor", () => {
    for (const code of ["US", "CA", "MX", "BR", "AR", "JP", "IN", "AU", "TR", "RU", "UA", "AD", "", null]) {
      expect(currencyForCountry(code)).toBe("USD");
    }
  });

  it("lists the 27 EU members, 3 EEA states, the UK and Switzerland (plus two aliases)", () => {
    expect(EUROPE_COUNTRIES.size).toBe(27 + 3 + 2 + 2);
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

  it("falls back to the Accept-Language region, then to dollars", () => {
    expect(regionCurrency({ acceptLanguage: "de-DE,de" })).toBe("EUR");
    expect(regionCurrency({ acceptLanguage: "es-MX" })).toBe("USD");
    expect(regionCurrency({ acceptLanguage: "es" })).toBe("USD");
    expect(regionCurrency({})).toBe("USD");
  });
});

describe("resolveVisitorCurrency", () => {
  it("prefers the visitor's choice, then the stored billing currency, then the region", () => {
    expect(resolveVisitorCurrency({ cookie: "currency_choice=USD", stored: "eur", country: "ES" })).toBe("USD");
    expect(resolveVisitorCurrency({ stored: "eur", country: "US" })).toBe("EUR");
    expect(resolveVisitorCurrency({ stored: "usd", country: "ES" })).toBe("USD");
    expect(resolveVisitorCurrency({ stored: "gbp", country: "ES" })).toBe("EUR");
    expect(resolveVisitorCurrency({ country: "BR" })).toBe("USD");
  });

  it("reads the request headers", () => {
    const headers = new Headers({ "x-vercel-ip-country": "CH", "accept-language": "en-US" });
    expect(resolveVisitorCurrencyFromHeaders(headers)).toBe("EUR");
    expect(resolveVisitorCurrencyFromHeaders(new Headers({ "accept-language": "fr-FR" }))).toBe("EUR");
  });
});

describe("cookies", () => {
  it("reads the choice first, then the region guess, else dollars", () => {
    expect(currencyFromCookieHeader("locale=es; currency=EUR")).toBe("EUR");
    expect(currencyFromCookieHeader("currency=EUR; currency_choice=USD")).toBe("USD");
    expect(currencyFromCookieHeader("currency=USD")).toBe("USD");
    expect(currencyFromCookieHeader("")).toBe("USD");
    expect(currencyFromCookieHeader(undefined)).toBe("USD");
    expect(choiceFromCookieHeader("currency=EUR")).toBeNull();
  });

  it("formats with the matching symbol", () => {
    expect(formatPrice(60, "USD")).toBe("$60");
    expect(formatPrice(60, "EUR")).toBe("€60");
  });
});

describe("switch copy", () => {
  it("names the other currency in both languages", () => {
    expect(en.currency.pricesIn).toBe("Prices in {currency}");
    expect(es.currency.pricesIn).toBe("Precios en {currency}");
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
