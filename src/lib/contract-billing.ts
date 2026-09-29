// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Pay per contract (owner decision 2026-09-29), the pure rules.
 *
 * Drafting and negotiating are free. A contract is paid at the moment of
 * value: the download (PDF, DOCX, TXT) or the start of the signature. One
 * price per contract whatever the template (premium skills fold into it);
 * a monthly plan gives unlimited contracts; agents pay the same price per
 * contract through prepaid credits sold in packs of ten.
 *
 * No price or amount is written here. Stripe price ids come from the six
 * environment variables below; amounts shown to people are read from the
 * Stripe price those ids point to (`src/server/services/billing/pricing.ts`).
 */

type Env = Record<string, string | undefined>;

export const CONTRACT_PRICE_ENV = {
  contract: { usd: "STRIPE_PRICE_CONTRACT_USD", eur: "STRIPE_PRICE_CONTRACT_EUR" },
  credits10: { usd: "STRIPE_PRICE_CREDITS_10_USD", eur: "STRIPE_PRICE_CREDITS_10_EUR" },
  monthly: { usd: "STRIPE_PRICE_MONTHLY_USD", eur: "STRIPE_PRICE_MONTHLY_EUR" },
} as const;

export type BillingProduct = keyof typeof CONTRACT_PRICE_ENV;
export type BillingCurrency = "usd" | "eur";
export const BILLING_CURRENCIES: readonly BillingCurrency[] = ["usd", "eur"];

/** The six price variables, in a stable order (docs, checks, STATUS). */
export const CONTRACT_PRICE_ENV_KEYS: readonly string[] = Object.values(CONTRACT_PRICE_ENV).flatMap(
  (byCurrency) => [byCurrency.usd, byCurrency.eur],
);

/** Contracts in one agent credit pack. */
export const CREDITS_PER_PACK = 10;

/**
 * Whether all six price variables are set. On the hosted deployment this
 * is the switch: with them, billing is on and the pilot mechanics go; with
 * any missing, hosted stays the free pilot. (`next.config.ts` repeats the
 * rule to inline `NEXT_PUBLIC_CONTRACT_BILLING` for the browser bundle.)
 */
export function contractPricesConfigured(env: Env): boolean {
  return CONTRACT_PRICE_ENV_KEYS.every((key) => !!env[key]?.trim());
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

/**
 * Currency for a person: a stored preference wins; otherwise the interface
 * language decides (Spanish → euros, English → dollars). The person can
 * switch at checkout, and the choice is then stored.
 */
export function chooseCurrency(opts: {
  requested?: unknown;
  stored?: unknown;
  locale?: string | null;
}): BillingCurrency {
  if (isBillingCurrency(opts.requested)) return opts.requested;
  if (isBillingCurrency(opts.stored)) return opts.stored;
  return opts.locale?.toLowerCase().startsWith("es") ? "eur" : "usd";
}

/** Subscription statuses under which the monthly plan covers new contracts. */
export function planCoversContracts(status: string, currentPeriodEnd: Date | null, now = new Date()): boolean {
  if (status !== "active" && status !== "trialing") return false;
  return !currentPeriodEnd || currentPeriodEnd.getTime() > now.getTime();
}

/**
 * Deals that predate billing are not charged: a deal already in signature
 * or completed without a payment row reached that point before the gate
 * existed (signature cannot start unpaid once billing is on). An optional
 * `CONTRACT_BILLING_START` (ISO date) also frees deals created before it,
 * so contracts negotiated during the free period stay free to download.
 */
export function dealPredatesBilling(
  deal: { status: string; createdAt: Date; hasSigningRequest: boolean },
  env: Env = process.env,
): boolean {
  if (deal.hasSigningRequest || deal.status === "SIGNING" || deal.status === "COMPLETED") return true;
  const start = env.CONTRACT_BILLING_START?.trim();
  if (!start) return false;
  const startAt = new Date(start);
  return !Number.isNaN(startAt.getTime()) && deal.createdAt.getTime() < startAt.getTime();
}

/** The plain message an unpaid download or signature receives (HTTP 402). */
export const PAYMENT_REQUIRED_MESSAGE =
  "This contract is not paid yet. Drafting and negotiating are free; downloading or signing the contract needs a one-off payment or the monthly plan.";

export const AGENT_PAYMENT_REQUIRED_MESSAGE =
  "This contract is not paid yet and this API key has no credits left. Buy a pack of ten credits (POST /api/v1/agent/credits/checkout); one credit is spent when the agreed contract is first fetched.";

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
