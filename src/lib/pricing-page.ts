// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The facts the public `/pricing` page states, derived from the price
 * configuration only (`src/lib/contract-billing.ts`). No amount is written
 * here: the text amounts come from `displayPrice`, the numbers in the
 * structured data from the same two sources it reads (`PRICE_DISPLAY_*`
 * when it is a plain number, otherwise the Stripe amount).
 */

import {
  BILLING_CURRENCIES,
  CREDITS_PER_PACK,
  PRICE_DISPLAY_ENV,
  billingStartDate,
  displayPrice,
  type BillingCurrency,
  type BillingProduct,
} from "@/lib/contract-billing";

type Env = Record<string, string | undefined>;

/** Stripe amounts in minor units, per product and currency (null = unknown). */
export type MinorAmounts = Record<BillingProduct, Record<BillingCurrency, number | null>>;

export interface PricingFacts {
  contract: Record<BillingCurrency, string | null>;
  pack: Record<BillingCurrency, string | null>;
  /** The pack's saving over ten single contracts, when it can be computed and is the same in both currencies. */
  packDiscountPercent: number | null;
  packSize: number;
  /** The billing start date, formatted for the locale (UTC), or null. */
  billingStart: string | null;
  /** Numeric amounts for the structured data. */
  numbers: Record<BillingProduct, Record<BillingCurrency, number | null>>;
}

const PLAIN_AMOUNT = /^\d+(\.\d{1,2})?$/;

/** The amount as a number, from the same sources `displayPrice` reads. */
export function priceNumber(
  product: BillingProduct,
  currency: BillingCurrency,
  opts: { stripeMinor?: number | null; env?: Env } = {},
): number | null {
  const env = opts.env ?? process.env;
  const raw = env[PRICE_DISPLAY_ENV[product]]?.trim();
  if (raw) return PLAIN_AMOUNT.test(raw) ? Number.parseFloat(raw) : null;
  return typeof opts.stripeMinor === "number" ? opts.stripeMinor / 100 : null;
}

export function formatBillingStart(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function pricingFacts(opts: {
  minor?: MinorAmounts | null;
  locale: string;
  env?: Env;
}): PricingFacts {
  const env = opts.env ?? process.env;
  const per = <T>(fn: (product: BillingProduct, currency: BillingCurrency) => T) => ({
    contract: Object.fromEntries(BILLING_CURRENCIES.map((c) => [c, fn("contract", c)])) as Record<BillingCurrency, T>,
    credits10: Object.fromEntries(BILLING_CURRENCIES.map((c) => [c, fn("credits10", c)])) as Record<BillingCurrency, T>,
  });

  const shown = per((product, currency) =>
    displayPrice(product, currency, { stripeMinor: opts.minor?.[product][currency], locale: opts.locale, env }),
  );
  const numbers = per((product, currency) =>
    priceNumber(product, currency, { stripeMinor: opts.minor?.[product][currency], env }),
  );

  const discounts = BILLING_CURRENCIES.map((c) => {
    const single = numbers.contract[c];
    const pack = numbers.credits10[c];
    if (!single || !pack) return null;
    const pct = Math.round((1 - pack / (single * CREDITS_PER_PACK)) * 100);
    return pct > 0 ? pct : null;
  });
  const packDiscountPercent = discounts.every((d) => d !== null && d === discounts[0]) ? discounts[0] : null;

  const start = billingStartDate(env);
  return {
    contract: shown.contract,
    pack: shown.credits10,
    packDiscountPercent,
    packSize: CREDITS_PER_PACK,
    billingStart: start ? formatBillingStart(start, opts.locale) : null,
    numbers,
  };
}

/**
 * Schema.org `Product` with two offers (one contract, a pack of ten
 * credits), each priced in every currency whose amount is known. Null when
 * no amount is known at all.
 */
export function pricingJsonLd(facts: PricingFacts, url: string): Record<string, unknown> | null {
  const specs = (product: BillingProduct, unitText: string) =>
    BILLING_CURRENCIES.flatMap((c) => {
      const price = facts.numbers[product][c];
      return price === null
        ? []
        : [{ "@type": "UnitPriceSpecification", price: price.toFixed(2), priceCurrency: c.toUpperCase(), unitText }];
    });

  const offers = [
    { name: "One contract", specs: specs("contract", "per contract") },
    { name: `Pack of ${facts.packSize} agent credits`, specs: specs("credits10", `per pack of ${facts.packSize} contracts`) },
  ]
    .filter((o) => o.specs.length > 0)
    .map((o) => ({
      "@type": "Offer",
      name: o.name,
      url,
      priceCurrency: o.specs[0].priceCurrency,
      price: o.specs[0].price,
      priceSpecification: o.specs,
    }));
  if (offers.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Dealroom contract",
    description:
      "Contract negotiation on Dealroom. Drafting and negotiating are free; each contract is paid once, when it is first downloaded or its signature starts.",
    brand: { "@type": "Brand", name: "Dealroom" },
    url,
    offers,
  };
}
