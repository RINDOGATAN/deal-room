// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Currency helper — reads the geo-IP currency cookie set by middleware.
 * Storefront rule: dollars unless the visitor is known to be outside the
 * US; euros only for a known non-US visitor. No cookie (or no known
 * country) therefore means dollars.
 */

export type Currency = "USD" | "EUR";

/** The middleware's choice for a visitor's country header ("" = unknown). */
export function currencyForCountry(country: string | null | undefined): Currency {
  const code = (country ?? "").trim().toUpperCase();
  return code && code !== "US" ? "EUR" : "USD";
}

export function currencyFromCookieHeader(cookie: string | null | undefined): Currency {
  const match = (cookie ?? "").match(/(?:^|;\s*)currency=(\w+)/);
  return match?.[1] === "EUR" ? "EUR" : "USD";
}

export function getCurrency(): Currency {
  if (typeof document === "undefined") return "USD";
  return currencyFromCookieHeader(document.cookie);
}

export function formatPrice(amount: number, currency: Currency = getCurrency()): string {
  return currency === "USD" ? `$${amount}` : `€${amount}`;
}
