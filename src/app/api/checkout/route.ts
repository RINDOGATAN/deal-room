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

    // Look up all requested skill packages (deduplicate in case id and skillId match the same row)
    const skillPackagesRaw = await prisma.skillPackage.findMany({
      where: {
        OR: skillPackageIds.flatMap((id) => [{ id }, { skillId: id }]),
        isPremium: true,
      },
    });
    const skillPackages = [...new Map(skillPackagesRaw.map((p: any) => [p.id, p])).values()];

    if (skillPackages.length < skillPackageIds.length) {
      const foundIds = new Set(skillPackages.flatMap((p: any) => [p.id, p.skillId]));
      const missing = skillPackageIds.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        { error: `Skill packages not found: ${missing.join(", ")}` },
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
