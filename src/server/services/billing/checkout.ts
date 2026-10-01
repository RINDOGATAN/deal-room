// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Shared steps of the pay-per-contract checkouts: the currency (stored
 * preference, else the visitor's region) and the base URL Stripe returns
 * to. The base URL comes from configuration, never from the request's
 * Origin header, so a forged header cannot redirect a paying customer.
 */

import prisma from "@/lib/prisma";
import { brand } from "@/config/brand";
import { chooseCurrency, isBillingCurrency, type BillingCurrency } from "@/lib/contract-billing";
import { resolveChosenLocale } from "@/lib/locale-cookie";

export function appBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || `https://${brand.appDomain}`).replace(/\/$/, "");
}

export function localeFromRequest(cookieHeader: string | null): "en" | "es" {
  return resolveChosenLocale(cookieHeader) === "es" ? "es" : "en";
}

/**
 * The customer's currency. An explicit request wins and is remembered in
 * `Customer.metadata.preferredCurrency` for next time; then the stored
 * preference; then `fallback` (the visitor's region guess).
 */
export async function currencyForCustomer(
  customerId: string,
  requested: unknown,
  fallback: BillingCurrency,
): Promise<BillingCurrency> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { metadata: true },
  });
  const metadata =
    customer?.metadata && typeof customer.metadata === "object" && !Array.isArray(customer.metadata)
      ? (customer.metadata as Record<string, unknown>)
      : {};
  const currency = chooseCurrency({ requested, stored: metadata.preferredCurrency, fallback });
  if (isBillingCurrency(requested) && metadata.preferredCurrency !== requested) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { metadata: { ...metadata, preferredCurrency: requested } },
    });
  }
  return currency;
}
