/**
 * Agent API — Subscribe to Premium Skills
 *
 * POST /api/checkout/subscribe
 * Creates a Stripe Checkout session for subscribing to premium skills.
 * Returns the checkout URL for the admin to open in a browser.
 *
 * NOTE: This file lives at /checkout/credits for backward compat.
 * The preferred path is POST /api/v1/agent/subscribe.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createCheckoutSession, getOrCreateStripeCustomer } from "@/lib/stripe";
import { features } from "@/config/features";
import { brand } from "@/config/brand";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { apiError } from "@/lib/api-response";

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

    const body = await req.json();
    const { skillIds, returnUrl } = body as {
      skillIds?: string[];
      returnUrl?: string;
    };

    if (!skillIds?.length) {
      return NextResponse.json(
        { error: "skillIds is required (array of skill IDs or skillId strings)" },
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

    // Resolve Stripe prices
    const fallbackPriceId = process.env.STRIPE_PRICE_ID;
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

    // Group line items by price ID
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
      skills: skillPackages.map((p) => ({
        skillId: p.skillId,
        displayName: p.displayName,
        priceAmount: p.priceAmount,
        priceCurrency: p.priceCurrency,
      })),
    });
  } catch (error) {
    return apiError(error, "Internal server error");
  }
}
