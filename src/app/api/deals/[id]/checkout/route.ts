// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * POST /api/deals/[id]/checkout — "Get this contract".
 *
 * Opens a hosted Stripe checkout for one contract (the per-contract price
 * in the person's currency), with the deal id in the metadata. On success
 * Stripe returns to the signing page, which confirms the session and shows
 * the signature; the webhook records the same payment independently.
 *
 * Body (optional): { currency?: "usd" | "eur" } for API callers. The app
 * sends none: the stored billing currency, else the region, decides.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";
import { createBillingCheckout, getOrCreateStripeCustomer } from "@/lib/stripe";
import { priceIdFor } from "@/lib/contract-billing";
import { resolveVisitorCurrencyFromHeaders, toBillingCurrency } from "@/lib/currency";
import { isDealSignable, validateDealAccess } from "@/server/services/document/generator";
import { isDealPaid } from "@/server/services/billing/deal-entitlement";
import {
  appBaseUrl,
  currencyForCustomer,
  localeFromRequest,
} from "@/server/services/billing/checkout";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!features.stripeEnabled) {
    return NextResponse.json({ error: "Payments are disabled; every contract is free" }, { status: 409 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: dealRoomId } = await params;
    if (!(await validateDealAccess(dealRoomId, session.user.id))) {
      return NextResponse.json({ error: "You are not a party to this deal" }, { status: 403 });
    }
    if (!(await isDealSignable(dealRoomId))) {
      return NextResponse.json(
        { error: "The contract can be bought once every clause is agreed" },
        { status: 400 },
      );
    }
    if ((await isDealPaid(dealRoomId)).paid) {
      return NextResponse.json({ error: "This contract is already paid", alreadyPaid: true }, { status: 409 });
    }

    const body = (await request.json().catch(() => ({}))) as { currency?: unknown };
    const locale = localeFromRequest(request.headers.get("cookie"));
    const { customerId, stripeCustomerId } = await getOrCreateStripeCustomer(
      prisma,
      session.user.email,
      session.user.name || undefined,
    );
    const currency = await currencyForCustomer(
      customerId,
      body.currency,
      toBillingCurrency(resolveVisitorCurrencyFromHeaders(request.headers)),
    );
    const priceId = priceIdFor("contract", currency);
    if (!priceId) {
      return NextResponse.json({ error: "The contract price is not configured" }, { status: 503 });
    }

    const base = appBaseUrl();
    const checkout = await createBillingCheckout({
      mode: "payment",
      priceId,
      stripeCustomerId,
      locale,
      currency,
      metadata: { kind: "contract", dealRoomId, customerId, userId: session.user.id },
      // Back to the signing page: after paying, the next step is the signature.
      successUrl: `${base}/deals/${dealRoomId}/sign?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/deals/${dealRoomId}/sign`,
    });

    return NextResponse.json({ url: checkout.url, currency });
  } catch (error) {
    return apiError(error, "Failed to open the checkout");
  }
}
