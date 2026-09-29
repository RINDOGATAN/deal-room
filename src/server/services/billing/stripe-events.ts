// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Stripe events for pay per contract: a contract bought for a deal, an
 * agent credit pack, and the monthly plan. Called by the idempotent webhook
 * (`/api/webhooks/stripe`, which claims each event id once) and by the
 * return from checkout (so the download unlocks even if the webhook is
 * still on its way). Every write is idempotent on its own as well: the
 * checkout session id is unique in `deal_payments`, and a purchase or a
 * reversal is unique per session in the credit ledger.
 */

import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { CREDITS_PER_PACK } from "@/lib/contract-billing";
import { createLogger } from "@/lib/logger";

const logger = createLogger("billing-events");

export const BILLING_KINDS = ["contract", "credits", "plan"] as const;
export type BillingKind = (typeof BILLING_KINDS)[number];

export function billingKindOf(metadata: Stripe.Metadata | null | undefined): BillingKind | null {
  const kind = metadata?.kind;
  return (BILLING_KINDS as readonly string[]).includes(kind ?? "") ? (kind as BillingKind) : null;
}

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** A contract bought for one deal. Only a paid session unlocks it. */
async function fulfilContract(session: Stripe.Checkout.Session) {
  const meta = session.metadata ?? {};
  if (!meta.dealRoomId) {
    logger.error("contract checkout without a deal id", { sessionId: session.id });
    return;
  }
  const data = {
    dealRoomId: meta.dealRoomId,
    kind: "CONTRACT" as const,
    status: "PAID" as const,
    payerUserId: meta.userId || null,
    customerId: meta.customerId || null,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: idOf(session.payment_intent as string | Stripe.PaymentIntent | null),
    amount: session.amount_total ?? null,
    currency: session.currency ?? null,
  };
  await prisma.dealPayment.upsert({
    where: { stripeCheckoutSessionId: session.id },
    // A redelivery must not revive a payment that was refunded since.
    update: { stripePaymentIntentId: data.stripePaymentIntentId },
    create: data,
  });
  logger.info("contract paid", { dealRoomId: meta.dealRoomId, sessionId: session.id });
}

/** A pack of credits for one agent API key. */
async function fulfilCredits(session: Stripe.Checkout.Session) {
  const meta = session.metadata ?? {};
  if (!meta.apiKeyId || !meta.customerId) {
    logger.error("credit checkout without a key id", { sessionId: session.id });
    return;
  }
  const credits = Number.parseInt(meta.credits ?? "", 10) || CREDITS_PER_PACK;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.agentCredit.upsert({
        where: { apiKeyId: meta.apiKeyId },
        update: {},
        create: { apiKeyId: meta.apiKeyId, customerId: meta.customerId, balance: 0 },
      });
      // Unique per (session, PURCHASE): a second delivery fails here and
      // the whole transaction, balance included, rolls back.
      await tx.agentCreditEntry.create({
        data: {
          apiKeyId: meta.apiKeyId,
          delta: credits,
          reason: "PURCHASE",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: idOf(session.payment_intent as string | Stripe.PaymentIntent | null),
        },
      });
      await tx.agentCredit.update({
        where: { apiKeyId: meta.apiKeyId },
        data: { balance: { increment: credits } },
      });
    });
    logger.info("credits added", { apiKeyId: meta.apiKeyId, credits, sessionId: session.id });
  } catch (err) {
    if (isUniqueViolation(err)) return; // already credited
    throw err;
  }
}

/** Store or refresh the monthly plan from its Stripe subscription. */
export async function syncPlanSubscription(subscription: Stripe.Subscription, customerIdHint?: string) {
  const customerId = subscription.metadata?.customerId || customerIdHint;
  if (!customerId) {
    logger.error("plan subscription without a customer id", { subscriptionId: subscription.id });
    return;
  }
  // The period moved from the subscription to its items in recent API
  // versions; read whichever is present.
  const legacy = subscription as unknown as { current_period_start?: number; current_period_end?: number };
  const item = subscription.items?.data?.[0] as
    | { current_period_start?: number; current_period_end?: number }
    | undefined;
  const start = legacy.current_period_start ?? item?.current_period_start;
  const end = legacy.current_period_end ?? item?.current_period_end;
  const period = {
    currentPeriodStart: start ? new Date(start * 1000) : null,
    currentPeriodEnd: end ? new Date(end * 1000) : null,
  };
  await prisma.contractPlan.upsert({
    where: { stripeSubscriptionId: subscription.id },
    update: { status: subscription.status, ...period },
    create: { customerId, stripeSubscriptionId: subscription.id, status: subscription.status, ...period },
  });
}

/**
 * checkout.session.completed / async_payment_succeeded. `retrieveSubscription`
 * is injected so tests need no Stripe client.
 */
export async function fulfilCheckoutSession(
  session: Stripe.Checkout.Session,
  retrieveSubscription: (id: string) => Promise<Stripe.Subscription>,
) {
  const kind = billingKindOf(session.metadata);
  if (!kind) return false;

  if (kind === "plan") {
    const subscriptionId = idOf(session.subscription as string | Stripe.Subscription | null);
    if (!subscriptionId) {
      logger.error("plan checkout without a subscription", { sessionId: session.id });
      return true;
    }
    await syncPlanSubscription(await retrieveSubscription(subscriptionId), session.metadata?.customerId);
    return true;
  }

  // Card payments arrive "paid"; delayed methods (bank debits) arrive
  // "unpaid" and are fulfilled on checkout.session.async_payment_succeeded.
  if (session.payment_status !== "paid") {
    logger.info("checkout completed, payment not yet received", { sessionId: session.id, kind });
    return true;
  }
  if (kind === "contract") await fulfilContract(session);
  else await fulfilCredits(session);
  return true;
}

/** Revert a contract payment: the deal is unpaid again. */
async function revokeContractPayments(where: Prisma.DealPaymentWhereInput, reason: string) {
  const res = await prisma.dealPayment.updateMany({
    where: { ...where, kind: "CONTRACT", status: "PAID" },
    data: { status: "REVOKED", revokedAt: new Date(), revokedReason: reason },
  });
  return res.count;
}

/** Take back an unspent pack. The balance may go below zero; it then blocks new spending. */
async function reverseCreditPurchase(purchase: {
  apiKeyId: string;
  delta: number;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
}) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.agentCreditEntry.create({
        data: {
          apiKeyId: purchase.apiKeyId,
          delta: -purchase.delta,
          reason: "REVERSAL",
          stripeCheckoutSessionId: purchase.stripeCheckoutSessionId,
          stripePaymentIntentId: purchase.stripePaymentIntentId,
        },
      });
      await tx.agentCredit.update({
        where: { apiKeyId: purchase.apiKeyId },
        data: { balance: { decrement: purchase.delta } },
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) return; // already reversed
    throw err;
  }
}

/** checkout.session.async_payment_failed: nothing is granted; anything granted is reverted. */
export async function handleCheckoutPaymentFailed(session: Stripe.Checkout.Session) {
  const kind = billingKindOf(session.metadata);
  if (kind === "contract") {
    await revokeContractPayments({ stripeCheckoutSessionId: session.id }, "payment_failed");
  } else if (kind === "credits") {
    const purchase = await prisma.agentCreditEntry.findFirst({
      where: { stripeCheckoutSessionId: session.id, reason: "PURCHASE" },
    });
    if (purchase) await reverseCreditPurchase(purchase);
  }
  return kind !== null;
}

/**
 * charge.refunded. A full refund reverts what the payment bought: the
 * contract becomes unpaid, or the pack is taken back. Partial refunds (a
 * goodwill discount) leave the entitlement in place.
 */
export async function handleChargeRefunded(charge: Stripe.Charge) {
  if (!charge.refunded) {
    logger.info("partial refund, entitlement kept", { chargeId: charge.id });
    return;
  }
  const paymentIntentId = idOf(charge.payment_intent as string | Stripe.PaymentIntent | null);
  if (!paymentIntentId) return;

  const revoked = await revokeContractPayments({ stripePaymentIntentId: paymentIntentId }, "refunded");
  const purchase = await prisma.agentCreditEntry.findFirst({
    where: { stripePaymentIntentId: paymentIntentId, reason: "PURCHASE" },
  });
  if (purchase) await reverseCreditPurchase(purchase);
  logger.info("refund processed", { paymentIntentId, contractsRevoked: revoked, creditsReversed: !!purchase });
}
