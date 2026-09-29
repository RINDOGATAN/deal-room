// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Per-deal entitlement for pay per contract.
 *
 * A deal is paid when it holds a PAID `deal_payments` row: a one-off
 * payment for that deal, an agent credit spent on it, or the monthly plan
 * that covered it. The check runs only in the document routes (PDF, DOCX,
 * TXT) and at the start of the signature; negotiation, counter-offers and
 * the on-screen preview never call it. With Stripe off (the kit) every deal
 * counts as paid and nothing is read.
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { features } from "@/config/features";
import {
  AGENT_PAYMENT_REQUIRED_MESSAGE,
  PAYMENT_REQUIRED_MESSAGE,
  dealPredatesBilling,
  planCoversContracts,
} from "@/lib/contract-billing";

export type DealAccessVia = "billing_off" | "payment" | "predates_billing" | "plan" | "credit";
export type DealAccess = { paid: true; via: DealAccessVia } | { paid: false };

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function hasPaidRow(dealRoomId: string) {
  const row = await prisma.dealPayment.findFirst({
    where: { dealRoomId, status: "PAID" },
    select: { id: true },
  });
  return !!row;
}

async function predatesBilling(dealRoomId: string) {
  const deal = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    select: { status: true, createdAt: true, signingRequest: { select: { id: true } } },
  });
  if (!deal) return false;
  return dealPredatesBilling({
    status: deal.status,
    createdAt: deal.createdAt,
    hasSigningRequest: !!deal.signingRequest,
  });
}

/** The customer's active monthly plan, if any. */
export async function activePlanFor(customerId: string) {
  const plans = await prisma.contractPlan.findMany({
    where: { customerId },
    orderBy: { updatedAt: "desc" },
  });
  return plans.find((p) => planCoversContracts(p.status, p.currentPeriodEnd)) ?? null;
}

/** Record that the plan covered this deal, so it stays paid after the plan ends. */
async function recordPlanCoverage(opts: {
  dealRoomId: string;
  customerId: string;
  stripeSubscriptionId: string;
  payerUserId?: string;
  payerApiKeyId?: string;
}) {
  const dedupeKey = `plan:${opts.dealRoomId}`;
  await prisma.dealPayment.upsert({
    where: { dedupeKey },
    update: {
      status: "PAID",
      revokedAt: null,
      revokedReason: null,
      paidAt: new Date(),
      stripeSubscriptionId: opts.stripeSubscriptionId,
      customerId: opts.customerId,
    },
    create: {
      dealRoomId: opts.dealRoomId,
      kind: "PLAN",
      dedupeKey,
      customerId: opts.customerId,
      payerUserId: opts.payerUserId,
      payerApiKeyId: opts.payerApiKeyId,
      stripeSubscriptionId: opts.stripeSubscriptionId,
      amount: 0,
    },
  });
}

/** Whether the deal is paid, without spending anything. Used by the UI. */
export async function isDealPaid(dealRoomId: string): Promise<DealAccess> {
  if (!features.stripeEnabled) return { paid: true, via: "billing_off" };
  if (await hasPaidRow(dealRoomId)) return { paid: true, via: "payment" };
  if (await predatesBilling(dealRoomId)) return { paid: true, via: "predates_billing" };
  return { paid: false };
}

/**
 * Access for a signed-in person who is a party to the deal. A plan holder
 * gets the deal recorded as covered by the plan.
 */
export async function dealAccessForUser(
  dealRoomId: string,
  user: { id: string; email?: string | null },
): Promise<DealAccess> {
  const base = await isDealPaid(dealRoomId);
  if (base.paid || !user.email) return base;

  const customer = await prisma.customer.findFirst({
    where: { email: { equals: user.email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!customer) return { paid: false };

  const plan = await activePlanFor(customer.id);
  if (!plan) return { paid: false };

  await recordPlanCoverage({
    dealRoomId,
    customerId: customer.id,
    stripeSubscriptionId: plan.stripeSubscriptionId,
    payerUserId: user.id,
  });
  return { paid: true, via: "plan" };
}

/**
 * Spend one credit of the key on the deal. Atomic: the balance only drops
 * when the CREDIT row is written, and the row's dedupe key stops a second
 * concurrent fetch from spending again. Returns false when the key has no
 * credit left.
 */
export async function consumeCredit(opts: {
  dealRoomId: string;
  apiKeyId: string;
  customerId: string;
}): Promise<boolean> {
  try {
    return await prisma.$transaction(async (tx) => {
      const debited = await tx.agentCredit.updateMany({
        where: { apiKeyId: opts.apiKeyId, balance: { gte: 1 } },
        data: { balance: { decrement: 1 } },
      });
      if (debited.count === 0) return false;
      await tx.dealPayment.create({
        data: {
          dealRoomId: opts.dealRoomId,
          kind: "CREDIT",
          dedupeKey: `credit:${opts.dealRoomId}`,
          payerApiKeyId: opts.apiKeyId,
          customerId: opts.customerId,
        },
      });
      await tx.agentCreditEntry.create({
        data: {
          apiKeyId: opts.apiKeyId,
          delta: -1,
          reason: "CONSUME",
          dealRoomId: opts.dealRoomId,
        },
      });
      return true;
    });
  } catch (err) {
    // Another fetch of the same deal won the race: the deal is paid, and
    // this transaction rolled back, so nothing was spent twice.
    if (isUniqueViolation(err)) return true;
    throw err;
  }
}

/**
 * Access for an agent API key: an existing payment, then the customer's
 * monthly plan, then one of the key's prepaid credits.
 */
export async function dealAccessForAgent(
  dealRoomId: string,
  auth: { apiKeyId: string; customerId: string },
): Promise<DealAccess> {
  const base = await isDealPaid(dealRoomId);
  if (base.paid) return base;

  const plan = await activePlanFor(auth.customerId);
  if (plan) {
    await recordPlanCoverage({
      dealRoomId,
      customerId: auth.customerId,
      stripeSubscriptionId: plan.stripeSubscriptionId,
      payerApiKeyId: auth.apiKeyId,
    });
    return { paid: true, via: "plan" };
  }

  if (await consumeCredit({ dealRoomId, ...auth })) return { paid: true, via: "credit" };
  return { paid: false };
}

/** HTTP 402 for a person: plain message plus where to pay. */
export function paymentRequiredResponse(dealRoomId: string) {
  return NextResponse.json(
    {
      error: PAYMENT_REQUIRED_MESSAGE,
      code: "PAYMENT_REQUIRED",
      checkout: { method: "POST", url: `/api/deals/${dealRoomId}/checkout` },
      dealUrl: `/deals/${dealRoomId}?checkout=1`,
    },
    { status: 402 },
  );
}

/** HTTP 402 for an agent: plain message plus the credit endpoints. */
export function agentPaymentRequiredResponse() {
  return NextResponse.json(
    {
      error: AGENT_PAYMENT_REQUIRED_MESSAGE,
      code: "PAYMENT_REQUIRED",
      checkout: { method: "POST", url: "/api/v1/agent/credits/checkout" },
      balance: { method: "GET", url: "/api/v1/agent/credits/balance" },
    },
    { status: 402 },
  );
}
