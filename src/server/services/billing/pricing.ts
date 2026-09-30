// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Prices for pay per contract, read from the Stripe prices the four
 * environment variables point to (the display text may be overridden with
 * `PRICE_DISPLAY_CONTRACT` / `PRICE_DISPLAY_CREDITS_10`, see
 * `displayPrice`). Nothing here hard-codes an amount: change the price in
 * Stripe (or point a variable at a new price) and the product, the agent
 * card and the MCP discovery follow. Cached for ten minutes per server
 * instance so a page view never waits on Stripe twice.
 */

import { features } from "@/config/features";
import {
  BILLING_CURRENCIES,
  CONTRACT_PRICE_ENV,
  CREDITS_PER_PACK,
  displayPrice,
  priceIdFor,
  type BillingCurrency,
  type BillingProduct,
} from "@/lib/contract-billing";
import { getStripe } from "@/lib/stripe";
import { createLogger } from "@/lib/logger";

const logger = createLogger("billing-pricing");

export interface PricePoint {
  priceId: string;
  /** Minor units, as Stripe stores it (2900 = 29.00). */
  amount: number | null;
  currency: BillingCurrency;
}

export type PriceTable = Record<BillingProduct, Record<BillingCurrency, PricePoint | null>>;

const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; table: PriceTable } | null = null;

/** Test hook. */
export function resetPricingCache() {
  cache = null;
}

async function loadPoint(product: BillingProduct, currency: BillingCurrency): Promise<PricePoint | null> {
  const priceId = priceIdFor(product, currency);
  if (!priceId) return null;
  try {
    const price = await getStripe().prices.retrieve(priceId);
    return { priceId, amount: price.unit_amount ?? null, currency };
  } catch (err) {
    // The id stays usable for checkout even when the lookup fails; only the
    // display amount is missing, and the interface then shows no number.
    logger.error("could not read Stripe price", { product, currency, err: String(err) });
    return { priceId, amount: null, currency };
  }
}

export async function getPriceTable(): Promise<PriceTable | null> {
  if (!features.stripeEnabled) return null;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.table;

  const products = Object.keys(CONTRACT_PRICE_ENV) as BillingProduct[];
  const entries = await Promise.all(
    products.map(async (product) => {
      const points = await Promise.all(BILLING_CURRENCIES.map((c) => loadPoint(product, c)));
      return [product, { usd: points[0], eur: points[1] }] as const;
    }),
  );
  const table = Object.fromEntries(entries) as PriceTable;
  cache = { at: Date.now(), table };
  return table;
}

/**
 * The machine-readable price block for the agent card and MCP discovery.
 * Amounts are in minor units, straight from Stripe.
 */
export async function agentPricingBlock() {
  const table = await getPriceTable();
  if (!table) {
    return { model: "free", note: "Payments are off on this deployment; every contract is free." };
  }
  const amounts = (product: BillingProduct) =>
    Object.fromEntries(
      BILLING_CURRENCIES.map((c) => [c, table[product][c]?.amount ?? null]),
    );
  const display = (product: BillingProduct) =>
    Object.fromEntries(
      BILLING_CURRENCIES.map((c) => [c, displayPrice(product, c, { stripeMinor: table[product][c]?.amount })]),
    );
  return {
    model: "per_contract",
    unit: "contract",
    amountsMinorUnits: {
      contract: amounts("contract"),
      creditPack: amounts("credits10"),
    },
    display: {
      contract: display("contract"),
      creditPack: display("credits10"),
    },
    creditPackSize: CREDITS_PER_PACK,
    creditsHeldBy: "customer",
    creditsNote:
      "Credits belong to the customer that owns the API keys. Any of its keys spends from the one balance; rotating or revoking a key changes nothing.",
    chargedWhen:
      "An agent fetches the document of an agreed deal for the first time (PDF, DOCX or TXT). Negotiation is free.",
    buyCredits: "POST /api/v1/agent/credits/checkout",
    balance: "GET /api/v1/agent/credits/balance",
    unpaidResponse: "HTTP 402 with code PAYMENT_REQUIRED",
  };
}
