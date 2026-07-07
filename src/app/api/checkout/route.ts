// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createCheckoutSession, getOrCreateStripeCustomer } from "@/lib/stripe";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  // Payments disabled: never reach getStripe() (it throws). All skills are
  // free, so there is nothing to check out. Degrade to a clean 409.
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

    const body = await request.json();
    const { skillPackageIds, returnUrl } = body as { skillPackageIds?: string[]; returnUrl?: string };

    if (!skillPackageIds?.length) {
      return NextResponse.json(
        { error: "Missing required field: skillPackageIds" },
        { status: 400 }
      );
    }

    // Look up all requested skill packages (deduplicate in case id and skillId match the same row)
    const skillPackagesRaw = await prisma.skillPackage.findMany({
      where: {
        OR: skillPackageIds.flatMap((id) => [{ id }, { skillId: id }]),
        isPremium: true,
      },
    });
    const skillPackages = [...new Map(skillPackagesRaw.map((p) => [p.id, p] as const)).values()];

    if (skillPackages.length < skillPackageIds.length) {
      const foundIds = new Set(skillPackages.flatMap((p) => [p.id, p.skillId]));
      const missing = skillPackageIds.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        { error: `Skill packages not found: ${missing.join(", ")}` },
        { status: 404 }
      );
    }

    // Check for existing active entitlements
    const customer = await prisma.customer.findFirst({
      where: { email: { equals: session.user.email, mode: "insensitive" } },
      include: {
        entitlements: {
          where: {
            skillPackageId: { in: skillPackages.map((p) => p.id) },
            status: "ACTIVE",
          },
        },
      },
    });

    if (customer?.entitlements.length) {
      const alreadyEntitled = customer.entitlements
        .map((e) => skillPackages.find((p) => p.id === e.skillPackageId)?.displayName)
        .filter(Boolean);
      return NextResponse.json(
        { error: `Already subscribed: ${alreadyEntitled.join(", ")}` },
        { status: 400 }
      );
    }

    // Resolve Stripe price for each package (USD for US visitors, EUR otherwise)
    const country = request.headers.get("x-vercel-ip-country") || "";
    const isUSD = country === "US";
    const fallbackPriceId = isUSD
      ? (process.env.STRIPE_PRICE_ID_USD || process.env.STRIPE_PRICE_ID)
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
      session.user.email,
      session.user.name || undefined
    );

    // Group line items by price ID (Stripe doesn't allow duplicate price entries)
    const priceQuantities = new Map<string, number>();
    for (const item of lineItems) {
      priceQuantities.set(item.priceId, (priceQuantities.get(item.priceId) || 0) + 1);
    }

    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL;
    const checkoutSession = await createCheckoutSession({
      stripeCustomerId,
      customerEmail: session.user.email,
      customerId,
      skillPackageIds: lineItems.map((l) => l.packageId),
      lineItems: [...priceQuantities.entries()].map(([price, quantity]) => ({ price, quantity })),
      successUrl: returnUrl
        ? `${origin}/billing?success=true&session_id={CHECKOUT_SESSION_ID}&returnUrl=${encodeURIComponent(returnUrl)}`
        : `${origin}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: returnUrl
        ? `${origin}${returnUrl}`
        : `${origin}/billing?cancelled=true`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    return apiError(error, "Failed to create checkout session");
  }
}
