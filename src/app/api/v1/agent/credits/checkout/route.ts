// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — buy a pack of ten contract credits
 *
 * POST /api/v1/agent/credits/checkout
 * Opens a hosted Stripe checkout for one pack (price from
 * STRIPE_PRICE_CREDITS_10_USD / _EUR), with the key's customer id in the
 * metadata, and returns the URL for a person to open. When the payment
 * succeeds the webhook adds the credits to the customer's balance. Any key
 * of the customer spends from it: one credit the first time an agreed
 * deal's document is fetched. Rotating or revoking a key changes nothing.
 *
 * Body (optional): { currency?: "usd" | "eur", returnUrl?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createBillingCheckout, getOrCreateStripeCustomer } from "@/lib/stripe";
import { features } from "@/config/features";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { unauthorizedResponse } from "@/server/middleware/unauthorized";
import { apiError } from "@/lib/api-response";
import { CREDITS_PER_PACK, chooseCurrency, priceIdFor } from "@/lib/contract-billing";
import { appBaseUrl } from "@/server/services/billing/checkout";

function safeReturnUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!features.agentApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }
    if (!features.stripeEnabled) {
      return NextResponse.json(
        { error: "Payments are disabled; every contract is free" },
        { status: 409 }
      );
    }

    const auth = await authenticateApiKey(req);
    if (!auth) {
      return unauthorizedResponse();
    }
    try {
      requireScope(auth, "billing:read");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const body = (await req.json().catch(() => ({}))) as { currency?: unknown; returnUrl?: unknown };
    const currency = chooseCurrency({ requested: body.currency });
    const priceId = priceIdFor("credits10", currency);
    if (!priceId) {
      return NextResponse.json({ error: "The credit pack price is not configured" }, { status: 503 });
    }

    const { stripeCustomerId } = await getOrCreateStripeCustomer(
      prisma,
      auth.customer.email,
      auth.customer.name
    );

    const returnUrl = safeReturnUrl(body.returnUrl);
    const base = appBaseUrl();
    const checkoutSession = await createBillingCheckout({
      mode: "payment",
      priceId,
      stripeCustomerId,
      currency,
      // The credits belong to the key's customer; the key is noted for the
      // record only (any key of the customer spends from the balance).
      metadata: {
        kind: "credits",
        customerId: auth.customer.id,
        apiKeyId: auth.apiKey.id,
        credits: String(CREDITS_PER_PACK),
      },
      successUrl: returnUrl ?? `${base}/docs/agent-api?credits=added`,
      cancelUrl: returnUrl ?? `${base}/docs/agent-api`,
    });

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      credits: CREDITS_PER_PACK,
      currency,
    });
  } catch (error) {
    return apiError(error, "Failed to open the checkout");
  }
}
