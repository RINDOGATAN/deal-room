// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The facts /pricing states, for any page that shows a price (/pricing,
 * /developers, /developers.md): Stripe amounts through `getPriceTable`,
 * shaped by `pricingFacts`. Never fails a page: without the amounts, the
 * facts carry `PRICE_DISPLAY_*` when set, otherwise no number.
 */

import { features } from "@/config/features";
import { getPriceTable } from "@/server/services/billing/pricing";
import { pricingFacts, type MinorAmounts, type PricingFacts } from "@/lib/pricing-page";

async function minorAmounts(): Promise<MinorAmounts | null> {
  if (!features.stripeEnabled) return null;
  try {
    const table = await getPriceTable();
    if (!table) return null;
    return {
      contract: { usd: table.contract.usd?.amount ?? null, eur: table.contract.eur?.amount ?? null },
      credits10: { usd: table.credits10.usd?.amount ?? null, eur: table.credits10.eur?.amount ?? null },
    };
  } catch {
    return null;
  }
}

export async function loadPricingFacts(locale: string): Promise<PricingFacts> {
  return pricingFacts({ minor: await minorAmounts(), locale });
}
