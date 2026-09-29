// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * POST /api/checkout — the monthly plan: unlimited contracts.
 *
 * Pay per contract (2026-09-29) replaced the per-skill subscription: every
 * template is available and the contract is what is paid. This route now
 * opens the hosted checkout for the monthly plan (price from
 * STRIPE_PRICE_MONTHLY_USD / _EUR). A request for skill packages gets 410.
 *
 * Body: { plan?: "unlimited", currency?: "usd" | "eur", returnUrl?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createBillingCheckout, getOrCreateStripeCustomer } from "@/lib/stripe";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";
import { priceIdFor } from "@/lib/contract-billing";
import { activePlanFor } from "@/server/services/billing/deal-entitlement";
import {
  appBaseUrl,
  currencyForCustomer,
  localeFromRequest,
} from "@/server/services/billing/checkout";

/** Only same-site paths are accepted as a return target. */
function safeReturnPath(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export async function POST(request: NextRequest) {
  // Payments disabled: never reach getStripe() (it throws). Degrade to 409.
  if (!features.stripeEnabled) {
    return NextResponse.json(
      { error: "Payments are disabled; all skills are free" },
      { status: 409 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      skillPackageIds?: string[];
      plan?: string;
      currency?: unknown;
      returnUrl?: unknown;
    };

    if (body.skillPackageIds?.length) {
      return NextResponse.json(
        {
          error:
            "Skills are no longer sold one by one: every template is included and each contract is paid when you download or sign it. The monthly plan gives unlimited contracts.",
        },
        { status: 410 }
      );
    }
    if (body.plan && body.plan !== "unlimited") {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }

    const { customerId, stripeCustomerId } = await getOrCreateStripeCustomer(
      prisma,
      session.user.email,
      session.user.name || undefined
    );
    if (await activePlanFor(customerId)) {
      return NextResponse.json({ error: "You already have the monthly plan" }, { status: 409 });
    }

    const locale = localeFromRequest(request.headers.get("cookie"));
    const currency = await currencyForCustomer(customerId, body.currency, locale);
    const priceId = priceIdFor("monthly", currency);
    if (!priceId) {
      return NextResponse.json({ error: "The monthly plan price is not configured" }, { status: 503 });
    }

    const base = appBaseUrl();
    const returnPath = safeReturnPath(body.returnUrl);
    const checkout = await createBillingCheckout({
      mode: "subscription",
      priceId,
      stripeCustomerId,
      locale,
      metadata: { kind: "plan", customerId, userId: session.user.id ?? "" },
      successUrl: `${base}${returnPath ?? "/billing"}${returnPath?.includes("?") ? "&" : "?"}plan=active&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}${returnPath ?? "/billing"}`,
    });

    return NextResponse.json({ url: checkout.url, currency });
  } catch (error) {
    return apiError(error, "Failed to create checkout session");
  }
}
