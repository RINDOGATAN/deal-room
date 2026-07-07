// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — Subscribe to Premium Skills
 *
 * POST /api/v1/agent/subscribe
 * Creates a Stripe Checkout session for subscribing to premium skills.
 * Returns the checkout URL for the admin to open in a browser.
 *
 * Same subscription model as human users: EUR 9/mo (or $9/mo in the US)
 * per premium skill. Entitlements are activated automatically via
 * Stripe webhook after payment completes.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  createCheckoutSession,
  getOrCreateStripeCustomer,
} from "@/lib/stripe";
import { features } from "@/config/features";
import { brand } from "@/config/brand";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
  checkRateLimit,
} from "@/server/middleware/apiKeyAuth";
import { withIdempotency } from "@/server/middleware/idempotency";
import { createLogger } from "@/lib/logger";

const logger = createLogger("agent-api");

export async function POST(req: NextRequest) {
  try {
    if (!features.agentApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }
    if (!features.stripeEnabled) {
      return NextResponse.json(
        { error: "Payments are disabled; all skills are free" },
        { status: 409 }
      );
    }

    const auth = await authenticateApiKey(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requireScope(auth, "billing:read");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    return await withIdempotency(req, auth.customer.id, async () => {
    // Rate limit
    const rateLimit = await checkRateLimit(auth.customer.id, "default");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfter) },
        }
      );
    }

    const body = await req.json();
    const { skillIds, returnUrl } = body as {
      skillIds?: string[];
      returnUrl?: string;
    };

    if (!skillIds?.length) {
      // List available premium skills if no IDs provided
      const available = await prisma.skillPackage.findMany({
        where: { isPremium: true, isActive: true },
        select: {
          skillId: true,
          displayName: true,
          description: true,
          priceAmount: true,
          priceCurrency: true,
          jurisdictions: true,
          languages: true,
        },
        orderBy: { displayName: "asc" },
      });

      return NextResponse.json(
        {
          error:
            "skillIds is required. Pass an array of skillId strings to subscribe.",
          availableSkills: available,
        },
        { status: 400 }
      );
    }

    // Look up requested premium skill packages
    const skillPackagesRaw = await prisma.skillPackage.findMany({
      where: {
        OR: skillIds.flatMap((id) => [{ id }, { skillId: id }]),
        isPremium: true,
      },
    });
    const skillPackages = [
      ...new Map(skillPackagesRaw.map((p) => [p.id, p])).values(),
    ];

    if (skillPackages.length === 0) {
      return NextResponse.json(
        { error: "No premium skill packages found for the given IDs" },
        { status: 404 }
      );
    }

    // Check for existing active entitlements
    const existingEntitlements = await prisma.skillEntitlement.findMany({
      where: {
        customerId: auth.customer.id,
        skillPackageId: { in: skillPackages.map((p) => p.id) },
        status: "ACTIVE",
      },
      include: { skillPackage: { select: { displayName: true } } },
    });

    if (existingEntitlements.length > 0) {
      const already = existingEntitlements.map(
        (e) => e.skillPackage.displayName
      );
      return NextResponse.json(
        { error: `Already subscribed: ${already.join(", ")}` },
        { status: 400 }
      );
    }

    // Resolve Stripe prices (use USD for US-based requests if configured)
    const country = req.headers.get("x-vercel-ip-country") || "";
    const isUSD = country === "US";
    const fallbackPriceId = isUSD
      ? process.env.STRIPE_PRICE_ID_USD || process.env.STRIPE_PRICE_ID
      : process.env.STRIPE_PRICE_ID;

    const lineItems: { priceId: string; packageId: string }[] = [];
    for (const pkg of skillPackages) {
      const priceId = pkg.stripePriceId || fallbackPriceId;
      if (!priceId) {
        return NextResponse.json(
          { error: `Stripe price not configured for ${pkg.displayName}` },
          { status: 500 }
        );
      }
      lineItems.push({ priceId, packageId: pkg.id });
    }

    // Get or create Stripe customer
    const { customerId, stripeCustomerId } = await getOrCreateStripeCustomer(
      prisma,
      auth.customer.email,
      auth.customer.name
    );

    // Group line items by price ID (Stripe doesn't allow duplicate price entries)
    const priceQuantities = new Map<string, number>();
    for (const item of lineItems) {
      priceQuantities.set(
        item.priceId,
        (priceQuantities.get(item.priceId) || 0) + 1
      );
    }

    const baseUrl =
      process.env.NEXTAUTH_URL || `https://${brand.appDomain}`;

    const checkoutSession = await createCheckoutSession({
      stripeCustomerId,
      customerEmail: auth.customer.email,
      customerId,
      skillPackageIds: lineItems.map((l) => l.packageId),
      lineItems: [...priceQuantities.entries()].map(([price, quantity]) => ({
        price,
        quantity,
      })),
      successUrl: returnUrl
        ? `${returnUrl}?success=true`
        : `${baseUrl}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: returnUrl
        ? `${returnUrl}?cancelled=true`
        : `${baseUrl}/billing?cancelled=true`,
    });

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      message:
        "Open this URL in a browser to complete the subscription. Entitlements activate automatically after payment.",
      skills: skillPackages.map((p) => ({
        skillId: p.skillId,
        displayName: p.displayName,
        priceAmount: p.priceAmount,
        priceCurrency: p.priceCurrency,
      })),
    });
    });
  } catch (error) {
    logger.error("Error creating subscription checkout", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
