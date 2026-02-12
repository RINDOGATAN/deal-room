import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createCheckoutSession, getOrCreateStripeCustomer } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { skillPackageIds } = body as { skillPackageIds?: string[] };

    if (!skillPackageIds?.length) {
      return NextResponse.json(
        { error: "Missing required field: skillPackageIds" },
        { status: 400 }
      );
    }

    // Look up all requested skill packages
    const skillPackages = await prisma.skillPackage.findMany({
      where: {
        OR: skillPackageIds.flatMap((id) => [{ id }, { skillId: id }]),
        isPremium: true,
      },
    });

    if (skillPackages.length !== skillPackageIds.length) {
      return NextResponse.json(
        { error: "One or more skill packages not found" },
        { status: 404 }
      );
    }

    // Check for existing active entitlements
    const customer = await prisma.customer.findUnique({
      where: { email: session.user.email },
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

    // Resolve Stripe price for each package
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
      session.user.email,
      session.user.name || undefined
    );

    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL;
    const checkoutSession = await createCheckoutSession({
      stripeCustomerId,
      customerEmail: session.user.email,
      customerId,
      skillPackageIds: lineItems.map((l) => l.packageId),
      lineItems: lineItems.map((l) => ({ price: l.priceId, quantity: 1 })),
      successUrl: `${origin}/billing?success=true`,
      cancelUrl: `${origin}/billing?cancelled=true`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout error:", error);
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
