// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One currency per visitor (owner decision 2026-10-01).
 *
 * Euros for a visitor in Europe (the EU and EEA countries, the United
 * Kingdom, Switzerland), dollars for everyone else. The region is the
 * hosting platform's country header (`x-vercel-ip-country`); without it,
 * the region of the first `Accept-Language` tag that names one; without
 * either, dollars.
 *
 * There is no currency switch (owner decision 2 October 2026): the region
 * decides. One cookie, for the browser session only: `currency`, the
 * region guess, written by the middleware. A signed-in customer's stored
 * billing currency wins over the region guess (server side,
 * `resolveVisitorCurrency`).
 */

export type Currency = "USD" | "EUR";

export const REGION_COOKIE = "currency";

/** ISO 3166-1 alpha-2 codes that see euros. */
export const EUROPE_COUNTRIES: ReadonlySet<string> = new Set([
  // European Union (27)
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // European Economic Area outside the EU
  "IS", "LI", "NO",
  // United Kingdom, Switzerland
  "GB", "CH",
  // Aliases seen in the wild: EL (the EU's own code for Greece), UK
  "EL", "UK",
  // Euro microstates and the British Crown dependencies and Gibraltar (owner, 1 October 2026)
  "AD", "MC", "SM", "VA", "GI", "JE", "GG", "IM",
]);

function normalise(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase();
}

/** Euros for a European country code, dollars for any other or none. */
export function currencyForCountry(country: string | null | undefined): Currency {
  return EUROPE_COUNTRIES.has(normalise(country)) ? "EUR" : "USD";
}

/**
 * The region of the first `Accept-Language` tag that carries a two-letter
 * region (`es-ES` → `ES`), in the visitor's order of preference. Null when
 * no tag names one (`es`, `en`, `es-419`).
 */
export function regionFromAcceptLanguage(header: string | null | undefined): string | null {
  const tags = (header ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: tag.trim(), weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((t) => t.tag && t.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const { tag } of tags) {
    const region = tag
      .split(/[-_]/)
      .slice(1)
      .find((sub) => /^[A-Za-z]{2}$/.test(sub));
    if (region) return region.toUpperCase();
  }
  return null;
}

/** The region guess: country header, then the `Accept-Language` region, then dollars. */
export function regionCurrency(opts: {
  country?: string | null;
  acceptLanguage?: string | null;
}): Currency {
  const country = normalise(opts.country);
  // Anything that is not two letters counts as no header.
  if (/^[A-Z]{2}$/.test(country)) return currencyForCountry(country);
  const region = regionFromAcceptLanguage(opts.acceptLanguage);
  return region ? currencyForCountry(region) : "USD";
}

/** "USD" / "usd" / "EUR" / "eur" → Currency; anything else → null. */
export function parseCurrency(value: unknown): Currency | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return upper === "USD" || upper === "EUR" ? upper : null;
}

function readCookie(cookie: string | null | undefined, name: string): string | null {
  const match = (cookie ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** The currency the browser should show: the region guess, else dollars. */
export function currencyFromCookieHeader(cookie: string | null | undefined): Currency {
  return parseCurrency(readCookie(cookie, REGION_COOKIE)) ?? "USD";
}

/**
 * Server side: a signed-in customer's stored billing currency, else the
 * region guess from the request headers.
 */
export function resolveVisitorCurrency(opts: {
  stored?: unknown;
  country?: string | null;
  acceptLanguage?: string | null;
}): Currency {
  return (
    parseCurrency(opts.stored) ??
    regionCurrency({ country: opts.country, acceptLanguage: opts.acceptLanguage })
  );
}

/** The same, from a request's headers (`next/headers` or `Request.headers`). */
export function resolveVisitorCurrencyFromHeaders(
  headers: { get(name: string): string | null },
  stored?: unknown,
): Currency {
  return resolveVisitorCurrency({
    stored,
    country: headers.get("x-vercel-ip-country"),
    acceptLanguage: headers.get("accept-language"),
  });
}

/** "USD" → "usd", the form the billing code and Stripe use. */
export function toBillingCurrency(currency: Currency): "usd" | "eur" {
  return currency === "EUR" ? "eur" : "usd";
}

export function getCurrency(): Currency {
  if (typeof document === "undefined") return "USD";
  return currencyFromCookieHeader(document.cookie);
}

/** For `useSyncExternalStore`: the region cookie does not change while a page is open. */
export function subscribeCurrency(): () => void {
  return () => {};
}

export function formatPrice(amount: number, currency: Currency = getCurrency()): string {
  return currency === "USD" ? `$${amount}` : `€${amount}`;
}
