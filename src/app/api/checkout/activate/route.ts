import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getStripe, getSubscription } from "@/lib/stripe";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";

/**
 * Activates entitlements for a completed Stripe checkout session.
 * Called from the billing page after Stripe redirects back, so the
 * entitlement is guaranteed active before the user is redirected to
 * the contract page. The webhook still fires as a backup.
 */
export async function POST(request: NextRequest) {
  // Payments disabled: there are no Stripe checkout sessions to activate, and
  // getStripe() would throw. Skills are already free, so degrade cleanly.
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

    const { sessionId } = (await request.json()) as { sessionId?: string };
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    if (checkoutSession.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const customerId = checkoutSession.metadata?.customerId;
    const skillPackageIds = checkoutSession.metadata?.skillPackageIds?.split(",").filter(Boolean) ?? [];

    if (!customerId || !skillPackageIds.length) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    // Verify this checkout belongs to the requesting user (case-insensitive)
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.email?.toLowerCase() !== session.user.email?.toLowerCase()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const subscriptionId =
      typeof checkoutSession.subscription === "string"
        ? checkoutSession.subscription
        : checkoutSession.subscription?.id;

    if (!subscriptionId) {
      return NextResponse.json({ error: "No subscription found" }, { status: 400 });
    }

    const subscription = await getSubscription(subscriptionId);
    const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;

    const skillPackages = await prisma.skillPackage.findMany({
      where: { id: { in: skillPackageIds } },
    });

    for (const skillPackageId of skillPackageIds) {
      const pkg = skillPackages.find((p) => p.id === skillPackageId);
      await prisma.skillEntitlement.upsert({
        where: {
          customerId_skillPackageId: { customerId: customer.id, skillPackageId },
        },
        update: {
          status: "ACTIVE",
          licenseType: "SUBSCRIPTION",
          stripeSubscriptionId: subscriptionId,
          jurisdictions: pkg?.jurisdictions ?? [],
          expiresAt: periodEnd ? new Date(periodEnd * 1000) : null,
        },
        create: {
          customerId: customer.id,
          skillPackageId,
          licenseType: "SUBSCRIPTION",
          status: "ACTIVE",
          stripeSubscriptionId: subscriptionId,
          jurisdictions: pkg?.jurisdictions ?? [],
          expiresAt: periodEnd ? new Date(periodEnd * 1000) : null,
        },
      });
    }

    return NextResponse.json({ activated: true, skillPackageIds });
  } catch (error) {
    return apiError(error, "Activation failed");
  }
}
