// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Pay per contract (owner decisions 2026-09-29), the pure rules.
 *
 * Drafting and negotiating are free. A contract is paid at the moment of
 * value: the download (PDF, DOCX, TXT) or the start of the signature. One
 * price per contract whatever the template (premium skills fold into it).
 * Agents pay the same way through prepaid credits sold in packs of ten;
 * the credits belong to the customer, and any of its API keys spends them.
 * There is no monthly plan (discarded in round 2).
 *
 * No price or amount is written here. Stripe price ids come from the four
 * environment variables below; the amounts shown to people come from
 * `PRICE_DISPLAY_CONTRACT` / `PRICE_DISPLAY_CREDITS_10` when set, otherwise
 * from the Stripe price the id points to (`src/server/services/billing/pricing.ts`).
 */

type Env = Record<string, string | undefined>;

export const CONTRACT_PRICE_ENV = {
  contract: { usd: "STRIPE_PRICE_CONTRACT_USD", eur: "STRIPE_PRICE_CONTRACT_EUR" },
  credits10: { usd: "STRIPE_PRICE_CREDITS_10_USD", eur: "STRIPE_PRICE_CREDITS_10_EUR" },
} as const;

export type BillingProduct = keyof typeof CONTRACT_PRICE_ENV;
export type BillingCurrency = "usd" | "eur";
export const BILLING_CURRENCIES: readonly BillingCurrency[] = ["usd", "eur"];

/** The four price variables, in a stable order (docs, checks, STATUS). */
export const CONTRACT_PRICE_ENV_KEYS: readonly string[] = Object.values(CONTRACT_PRICE_ENV).flatMap(
  (byCurrency) => [byCurrency.usd, byCurrency.eur],
);

/**
 * The date billing starts (ISO, for example `2026-10-01`). Required: a
 * deal created before it is never charged.
 */
export const CONTRACT_BILLING_START_ENV = "CONTRACT_BILLING_START";

/** The five variables that switch hosted billing on: four prices and the start date. */
export const CONTRACT_BILLING_ENV_KEYS: readonly string[] = [
  ...CONTRACT_PRICE_ENV_KEYS,
  CONTRACT_BILLING_START_ENV,
];

/** Optional display amounts, for example `29` or `217.50` (see `displayPrice`). */
export const PRICE_DISPLAY_ENV: Record<BillingProduct, string> = {
  contract: "PRICE_DISPLAY_CONTRACT",
  credits10: "PRICE_DISPLAY_CREDITS_10",
};

/** Contracts in one agent credit pack. */
export const CREDITS_PER_PACK = 10;

/** The billing start date, or null when it is missing or not a date. */
export function billingStartDate(env: Env = process.env): Date | null {
  const raw = env[CONTRACT_BILLING_START_ENV]?.trim();
  if (!raw) return null;
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * Whether hosted billing can switch on: all four price variables set and a
 * valid `CONTRACT_BILLING_START`. With any of the five missing, hosted stays
 * free. (`next.config.ts` repeats the rule to inline
 * `NEXT_PUBLIC_CONTRACT_BILLING` for the browser bundle.)
 */
export function contractBillingConfigured(env: Env): boolean {
  return CONTRACT_PRICE_ENV_KEYS.every((key) => !!env[key]?.trim()) && billingStartDate(env) !== null;
}

export function priceIdFor(
  product: BillingProduct,
  currency: BillingCurrency,
  env: Env = process.env,
): string | null {
  return env[CONTRACT_PRICE_ENV[product][currency]]?.trim() || null;
}

export function isBillingCurrency(value: unknown): value is BillingCurrency {
  return value === "usd" || value === "eur";
}

/** The billing currency stored on a customer (`Customer.metadata.preferredCurrency`), if any. */
export function preferredCurrency(metadata: unknown): unknown {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>).preferredCurrency
    : undefined;
}

/**
 * Currency for a person: an explicit request wins, then a stored
 * preference; otherwise `fallback` (the visitor's region guess, see
 * `src/lib/currency.ts`), else dollars. The person can switch before
 * checkout, and the choice is then stored.
 */
export function chooseCurrency(opts: {
  requested?: unknown;
  stored?: unknown;
  fallback?: BillingCurrency;
}): BillingCurrency {
  if (isBillingCurrency(opts.requested)) return opts.requested;
  if (isBillingCurrency(opts.stored)) return opts.stored;
  return opts.fallback ?? "usd";
}

/**
 * Deals that predate billing are not charged.
 *
 * - A deal already in signature or completed without a payment row reached
 *   that point before the gate existed (signature cannot start unpaid once
 *   billing is on).
 * - A deal created before `CONTRACT_BILLING_START` is free. A deal cannot be
 *   agreed before it exists, so every deal agreed before the start is free.
 *   The schema records no agreement date, so a deal created before the
 *   start but agreed after it is also left free (the conservative side).
 * - Without a valid start date nothing is charged at all. Hosted billing
 *   cannot switch on without it, so this only guards a misconfiguration.
 */
export function dealPredatesBilling(
  deal: { status: string; createdAt: Date; hasSigningRequest: boolean },
  env: Env = process.env,
): boolean {
  if (deal.hasSigningRequest || deal.status === "SIGNING" || deal.status === "COMPLETED") return true;
  const startAt = billingStartDate(env);
  if (!startAt) return true;
  return deal.createdAt.getTime() < startAt.getTime();
}

/** The plain message an unpaid download or signature receives (HTTP 402). */
export const PAYMENT_REQUIRED_MESSAGE =
  "This contract is not paid yet. Drafting and negotiating are free; downloading or signing the contract needs a one-off payment.";

export const AGENT_PAYMENT_REQUIRED_MESSAGE =
  "This contract is not paid yet and your account has no credits left. Buy a pack of ten credits (POST /api/v1/agent/credits/checkout); any API key of the account spends them, one credit when an agreed contract is first fetched.";

/** HTTP 410 from the retired plan / per-skill checkout (`POST /api/checkout`). */
export const CHECKOUT_GONE_MESSAGE =
  "This purchase is no longer offered. Every template is included, and each contract is paid once, on its deal page, when you download or sign it.";

/** HTTP 410 from the retired agent subscription (`POST /api/v1/agent/subscribe`). */
export const AGENT_SUBSCRIBE_GONE_MESSAGE =
  "Subscriptions are no longer offered. Every template is included, and each contract is paid with one prepaid credit: when it is made, for a contract made in one call, or when its document is first fetched, for a negotiated one. Buy credits in packs of ten at POST /api/v1/agent/credits/checkout.";

/** Display amount, for example 2900 + "eur" → "€29" and 950 + "usd" → "$9.50". */
export function formatAmount(minor: number, currency: string, locale = "en"): string {
  const whole = minor % 100 === 0;
  return new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** A plain amount such as `29` or `217.50`. */
const PLAIN_AMOUNT = /^\d+(\.\d{1,2})?$/;

/**
 * The amount to show for a product. `PRICE_DISPLAY_*` wins when set: a
 * plain number (`29`, `217.50`) is formatted in the chosen currency; any
 * other text is shown as written. Otherwise the Stripe amount (minor units)
 * is formatted. Null when neither is known, so the interface shows no
 * number rather than a wrong one.
 */
export function displayPrice(
  product: BillingProduct,
  currency: BillingCurrency,
  opts: { stripeMinor?: number | null; locale?: string; env?: Env } = {},
): string | null {
  const env = opts.env ?? process.env;
  const raw = env[PRICE_DISPLAY_ENV[product]]?.trim();
  if (raw) {
    return PLAIN_AMOUNT.test(raw)
      ? formatAmount(Math.round(Number.parseFloat(raw) * 100), currency, opts.locale)
      : raw;
  }
  return typeof opts.stripeMinor === "number" ? formatAmount(opts.stripeMinor, currency, opts.locale) : null;
}
