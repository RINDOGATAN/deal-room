import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { verifyWebhookSignature, getSubscription } from "@/lib/stripe";
import { features } from "@/config/features";
import { resend } from "@/lib/email";

function parseSkillPackageIds(metadata: Record<string, string> | null): string[] {
  if (!metadata) return [];
  if (metadata.skillPackageIds) {
    return metadata.skillPackageIds.split(",").filter(Boolean);
  }
  return [];
}

export async function POST(request: NextRequest) {
  if (!features.stripeEnabled) {
    return NextResponse.json(
      { error: "Stripe is not enabled" },
      { status: 403 }
    );
  }

  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(body, signature);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { customerId } = session.metadata || {};
  const skillPackageIds = parseSkillPackageIds(session.metadata as Record<string, string> | null);

  if (!customerId || !skillPackageIds.length) {
    console.error("Missing metadata in checkout session:", session.id);
    return;
  }

  if (!session.subscription) {
    console.error("No subscription in checkout session:", session.id);
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  const subscription = await getSubscription(subscriptionId);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    console.error("Customer not found for checkout session:", session.id);
    return;
  }

  // Update Stripe customer ID if needed
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  if (stripeCustomerId && customer.stripeCustomerId !== stripeCustomerId) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { stripeCustomerId },
    });
  }

  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;

  // Load skill packages to get jurisdictions
  const skillPackages = await prisma.skillPackage.findMany({
    where: { id: { in: skillPackageIds } },
  });

  for (const skillPackageId of skillPackageIds) {
    const pkg = skillPackages.find((p) => p.id === skillPackageId);
    await prisma.skillEntitlement.upsert({
      where: {
        customerId_skillPackageId: {
          customerId: customer.id,
          skillPackageId,
        },
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

  console.log(
    `Created entitlements for customer ${customer.id}, skills: ${skillPackageIds.join(", ")}`
  );
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const { customerId } = subscription.metadata || {};
  const skillPackageIds = parseSkillPackageIds(subscription.metadata as Record<string, string> | null);

  if (!customerId || !skillPackageIds.length) {
    return;
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    // Fallback: find by Stripe customer ID
    const stripeCustomerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    const byStripe = await prisma.customer.findFirst({
      where: { stripeCustomerId },
    });

    if (!byStripe) {
      console.error("Customer not found for subscription:", subscription.id);
      return;
    }

    await updateEntitlementStatus(byStripe.id, skillPackageIds, subscription);
    return;
  }

  await updateEntitlementStatus(customer.id, skillPackageIds, subscription);
}

async function updateEntitlementStatus(
  customerId: string,
  skillPackageIds: string[],
  subscription: Stripe.Subscription
) {
  let entitlementStatus: "ACTIVE" | "SUSPENDED" | "EXPIRED" = "ACTIVE";

  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    entitlementStatus = "SUSPENDED";
  } else if (
    subscription.status === "canceled" ||
    subscription.status === "incomplete_expired"
  ) {
    entitlementStatus = "EXPIRED";
  }

  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;

  for (const skillPackageId of skillPackageIds) {
    await prisma.skillEntitlement.upsert({
      where: {
        customerId_skillPackageId: {
          customerId,
          skillPackageId,
        },
      },
      update: {
        status: entitlementStatus,
        stripeSubscriptionId: subscription.id,
        expiresAt: periodEnd ? new Date(periodEnd * 1000) : null,
      },
      create: {
        customerId,
        skillPackageId,
        licenseType: "SUBSCRIPTION",
        status: entitlementStatus,
        stripeSubscriptionId: subscription.id,
        expiresAt: periodEnd ? new Date(periodEnd * 1000) : null,
      },
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const skillPackageIds = parseSkillPackageIds(subscription.metadata as Record<string, string> | null);

  if (!skillPackageIds.length) return;

  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const customer = await prisma.customer.findFirst({
    where: { stripeCustomerId },
  });

  if (!customer) return;

  await prisma.skillEntitlement.updateMany({
    where: {
      customerId: customer.id,
      skillPackageId: { in: skillPackageIds },
    },
    data: { status: "EXPIRED" },
  });

  console.log(
    `Expired entitlements for customer ${customer.id}, skills: ${skillPackageIds.join(", ")}`
  );
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!stripeCustomerId) return;

  const customer = await prisma.customer.findFirst({
    where: { stripeCustomerId },
  });

  if (!customer) return;

  await prisma.skillEntitlement.updateMany({
    where: {
      customerId: customer.id,
      status: "ACTIVE",
    },
    data: { status: "SUSPENDED" },
  });

  console.log(`Suspended entitlements for customer ${customer.id} due to payment failure`);

  if (customer.email) {
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "noreply@todo.law",
        to: customer.email,
        subject: "DEALROOM — Payment Failed",
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; overflow: hidden;">
            <div style="padding: 24px 24px 16px; border-bottom: 1px solid #2a2a2a;">
              <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">DEALROOM</span>
            </div>
            <div style="padding: 32px 24px;">
              <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">We were unable to process your latest payment. Your premium features have been temporarily suspended.</p>
              <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Please update your payment method to restore access.</p>
              <a href="${process.env.NEXTAUTH_URL}/billing" style="display: inline-block; background: #53aecc; color: #1a1a1a; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Update Payment Method</a>
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #2a2a2a;">
              <p style="color: #666666; font-size: 11px; margin: 0;">TODO.LAW\u2122 \u00b7 DEALROOM \u00b7 <a href="https://dealroom.todo.law" style="color: #53aecc; text-decoration: none;">dealroom.todo.law</a></p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send payment failure email:", emailErr);
    }
  }
}
