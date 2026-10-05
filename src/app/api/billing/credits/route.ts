// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * POST /api/billing/credits — "Buy credits" on Settings, API keys.
 *
 * The signed-in person's way to the same credit pack the agent buys at
 * POST /api/v1/agent/credits/checkout: one pack (STRIPE_PRICE_CREDITS_10_*),
 * with the person's customer id in the metadata, so the webhook adds the
 * credits to the balance every key of that customer spends from. No API
 * key is needed (the person may not have one yet). Returns the checkout
 * URL; Stripe returns to Settings, API keys.
 *
 * Body (optional): { currency?: "usd" | "eur" }. Without it the stored
 * billing currency, else the region, decides.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";
import { createBillingCheckout, getOrCreateStripeCustomer } from "@/lib/stripe";
import { CREDITS_PER_PACK, priceIdFor } from "@/lib/contract-billing";
import { resolveVisitorCurrencyFromHeaders, toBillingCurrency } from "@/lib/currency";
import { API_KEYS_SETTINGS_PATH } from "@/lib/api-key-scopes";
import { checkPublicRateLimit, tooManyRequests } from "@/server/middleware/public-rate-limit";
import {
  appBaseUrl,
  currencyForCustomer,
  localeFromRequest,
} from "@/server/services/billing/checkout";

export async function POST(request: NextRequest) {
  if (!features.selfServiceApiKeys) {
    return NextResponse.json({ error: "Payments are disabled; every contract is free" }, { status: 409 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = await checkPublicRateLimit("credits-checkout", session.user.id);
    if (!limit.allowed) return tooManyRequests(limit);

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
    const priceId = priceIdFor("credits10", currency);
    if (!priceId) {
      return NextResponse.json({ error: "The credit pack price is not configured" }, { status: 503 });
    }

    const base = appBaseUrl();
    const checkout = await createBillingCheckout({
      mode: "payment",
      priceId,
      stripeCustomerId,
      locale,
      currency,
      metadata: {
        kind: "credits",
        customerId,
        userId: session.user.id,
        credits: String(CREDITS_PER_PACK),
      },
      successUrl: `${base}${API_KEYS_SETTINGS_PATH}?credits=added`,
      cancelUrl: `${base}${API_KEYS_SETTINGS_PATH}`,
    });

    return NextResponse.json({ url: checkout.url, credits: CREDITS_PER_PACK, currency });
  } catch (error) {
    return apiError(error, "Failed to open the checkout");
  }
}
