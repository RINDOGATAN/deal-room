// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which weekly A2A limit a customer gets (owner decision 2026-10-01: the
 * limits follow the money).
 *
 * Standard: 5 negotiations per contract type per week. Extended: 300 a week
 * in total, for a customer that does any of the following:
 *   1. holds credits (balance above zero);
 *   2. bought a credit pack on or after `CONTRACT_BILLING_START` that has
 *      not been reversed (refund or failed payment);
 *   3. paid a contract on or after `CONTRACT_BILLING_START` (a PAID
 *      `deal_payments` row of kind CONTRACT or CREDIT for the customer);
 * or carries the hand-set `premiumA2A` flag in `Customer.metadata`, as
 * before. Without a valid start date, rules 2 and 3 never apply.
 */

import prisma from "@/lib/prisma";
import { billingStartDate } from "@/lib/contract-billing";

type Env = Record<string, string | undefined>;

export const A2A_STANDARD_LIMIT = 5;
export const A2A_EXTENDED_LIMIT = 300;

export interface A2aLimitFacts {
  premiumFlag: boolean;
  creditBalance: number;
  /** A pack bought since the billing start and not reversed. */
  packSinceStart: boolean;
  /** A contract paid since the billing start. */
  paymentSinceStart: boolean;
}

/** Pure: whether the facts earn the extended limit. */
export function qualifiesForExtendedA2a(facts: A2aLimitFacts): boolean {
  return facts.premiumFlag || facts.creditBalance > 0 || facts.packSinceStart || facts.paymentSinceStart;
}

export function hasPremiumA2aFlag(metadata: unknown): boolean {
  return (
    !!metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    !!(metadata as Record<string, unknown>).premiumA2A
  );
}

/** Reads the facts for one customer. */
export async function a2aLimitFacts(
  customer: { id: string; metadata: unknown },
  env: Env = process.env,
): Promise<A2aLimitFacts> {
  const premiumFlag = hasPremiumA2aFlag(customer.metadata);
  const start = billingStartDate(env);

  const [credit, purchases, payment] = await Promise.all([
    prisma.customerCredit.findUnique({ where: { customerId: customer.id }, select: { balance: true } }),
    start
      ? prisma.customerCreditEntry.findMany({
          where: { customerId: customer.id, reason: "PURCHASE", createdAt: { gte: start } },
          select: { stripeCheckoutSessionId: true },
        })
      : Promise.resolve([] as { stripeCheckoutSessionId: string | null }[]),
    start
      ? prisma.dealPayment.findFirst({
          where: {
            customerId: customer.id,
            status: "PAID",
            kind: { in: ["CONTRACT", "CREDIT"] },
            paidAt: { gte: start },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  let packSinceStart = false;
  if (purchases.length > 0) {
    const sessions = purchases.map((p) => p.stripeCheckoutSessionId).filter((s): s is string => !!s);
    const reversed = sessions.length
      ? await prisma.customerCreditEntry.findMany({
          where: { customerId: customer.id, reason: "REVERSAL", stripeCheckoutSessionId: { in: sessions } },
          select: { stripeCheckoutSessionId: true },
        })
      : [];
    const reversedIds = new Set(reversed.map((r) => r.stripeCheckoutSessionId));
    packSinceStart = purchases.some((p) => !p.stripeCheckoutSessionId || !reversedIds.has(p.stripeCheckoutSessionId));
  }

  return {
    premiumFlag,
    creditBalance: credit?.balance ?? 0,
    packSinceStart,
    paymentSinceStart: !!payment,
  };
}

export async function hasExtendedA2aLimit(
  customer: { id: string; metadata: unknown },
  env: Env = process.env,
): Promise<boolean> {
  // The hand-set flag needs no lookup.
  if (hasPremiumA2aFlag(customer.metadata)) return true;
  return qualifiesForExtendedA2a(await a2aLimitFacts(customer, env));
}

/** The 429 text when the limit is reached. `pricingUrl` null = billing off (nothing to buy). */
export function a2aLimitMessage(extended: boolean, pricingUrl: string | null): string {
  if (extended) {
    return `A2A weekly limit reached: accounts holding credits have ${A2A_EXTENDED_LIMIT} negotiations a week in total.`;
  }
  const base =
    `A2A limit reached: the standard limit is ${A2A_STANDARD_LIMIT} negotiations per contract type per week. ` +
    `Accounts holding credits have ${A2A_EXTENDED_LIMIT} a week.`;
  return pricingUrl
    ? `${base} Buy credits to lift it (the buy_credits tool, or POST /api/v1/agent/credits/checkout); prices at ${pricingUrl}.`
    : base;
}
