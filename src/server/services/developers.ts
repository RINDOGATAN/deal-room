// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Loads the developer quick start for one request: the contract types
 * from `listContractTypes` (the JSON endpoint's source) and the prices
 * from `loadPricingFacts` (the /pricing source), in the visitor's one
 * currency. Never fails the page: without the database the table says
 * where the list lives; without Stripe the prices show no number.
 */

import prisma from "@/lib/prisma";
import { features } from "@/config/features";
import { resolveVisitorCurrencyFromHeaders, toBillingCurrency } from "@/lib/currency";
import type { PageLocale } from "@/lib/contract-pages-paths";
import { buildDevelopersDoc, priceLines, type DevelopersDoc } from "@/lib/developers-doc";
import { listContractTypes } from "@/server/services/agent/contractTypes";
import { loadPricingFacts } from "@/server/services/billing/pricing-facts";
import { createLogger } from "@/lib/logger";

const logger = createLogger("developers-page");

export async function loadDevelopersDoc(
  locale: PageLocale,
  headers: { get(name: string): string | null },
): Promise<DevelopersDoc> {
  const [types, facts] = await Promise.all([
    listContractTypes(prisma, { lang: locale }).catch((err) => {
      logger.error("contract types unavailable", { err: String(err) });
      return [];
    }),
    features.stripeEnabled ? loadPricingFacts(locale).catch(() => null) : Promise.resolve(null),
  ]);
  const currency = toBillingCurrency(resolveVisitorCurrencyFromHeaders(headers));
  return buildDevelopersDoc({
    locale,
    types,
    prices: priceLines(locale, { billingOn: features.stripeEnabled, facts, currency }),
    billingOn: features.stripeEnabled,
  });
}
