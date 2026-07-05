import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { verifyWebhookSignature, getSubscription } from "@/lib/stripe";
import { features } from "@/config/features";
import { brand } from "@/config/brand";
import { getResend } from "@/lib/email";
import { generateDownloadToken } from "@/lib/crypto";
import { createLogger } from "@/lib/logger";

const logger = createLogger("stripe-webhook");

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
      logger.error("Webhook signature verification failed", { err: String(err) });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Claim this event.id atomically. Stripe's at-least-once delivery
    // guarantee means the same event can land multiple times — sequential
    // retries (after a transient 500), or near-concurrent if the first
    // delivery is slow. The unique-constraint insert is the single
    // serialization point: whichever request wins runs the handler;
    // others see P2002 and short-circuit. If the handler errors, we
    // delete the row so Stripe's next retry can re-claim and re-process.
    try {
      await prisma.stripeWebhookEvent.create({
        data: { id: event.id, eventType: event.type },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return NextResponse.json({ received: true, idempotent: true });
      }
      throw e;
    }

    try {
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

        case "invoice.payment_succeeded":
          await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case "invoice.payment_failed":
          await handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          logger.debug("Unhandled event type", { eventType: event.type });
      }
    } catch (handlerError) {
      // Structured log so the offending event is searchable in
      // Vercel logs without spelunking through 500-trace context.
      logger.error("handler failed", {
        eventId: event.id,
        eventType: event.type,
        // event.data.object shapes vary; the customer id is on most
        // of the ones we actually handle, so this is best-effort.
        stripeCustomerId:
          (event.data.object as { customer?: string | { id?: string } }).customer
            ? typeof (event.data.object as { customer?: string | { id?: string } }).customer === "string"
              ? (event.data.object as { customer: string }).customer
              : ((event.data.object as { customer: { id?: string } }).customer)?.id
            : undefined,
        err: handlerError instanceof Error ? handlerError.message : String(handlerError),
      });
      // Release the claim so Stripe's next retry can re-process.
      // .catch() because the row should still be there, but if some
      // other process removed it we don't want this cleanup to mask
      // the original error.
      await prisma.stripeWebhookEvent
        .delete({ where: { id: event.id } })
        .catch(() => undefined);
      throw handlerError;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("outer failure", { err: String(error) });
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
    logger.error("Missing metadata in checkout session", { sessionId: session.id });
    return;
  }

  if (!session.subscription) {
    logger.error("No subscription in checkout session", { sessionId: session.id });
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
    logger.error("Customer not found for checkout session", { sessionId: session.id });
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

  logger.info("Created entitlements for customer", {
    customerId: customer.id,
    skillPackageIds,
  });

  // Send download links for self-hosted customers
  if (customer.type === "SELF_HOSTED" && customer.email) {
    const downloadablePackages = skillPackages.filter((p) => p.packageUrl);
    if (downloadablePackages.length > 0) {
      const baseUrl = process.env.NEXTAUTH_URL || `https://${brand.appDomain}`;
      const downloadLinks = downloadablePackages.map((pkg) => {
        const token = generateDownloadToken(customer.id, pkg.skillId, 7 * 86400); // 7 days
        return {
          name: pkg.displayName,
          url: `${baseUrl}/api/skills/${pkg.skillId}/download?token=${token}`,
        };
      });

      try {
        await getResend().emails.send({
          from: process.env.EMAIL_FROM || `noreply@${brand.domain}`,
          to: customer.email,
          subject: "DEALROOM — Your Skill Packages Are Ready",
          html: `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: ${brand.colors.background}; border-radius: 12px; overflow: hidden;">
              <div style="padding: 24px 24px 16px; border-bottom: 1px solid ${brand.colors.border};">
                <span style="font-size: 20px; font-weight: 700; color: ${brand.colors.foreground}; letter-spacing: 0.05em;">DEALROOM</span>
              </div>
              <div style="padding: 32px 24px;">
                <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Your skill packages are ready to download and install on your self-hosted instance.</p>
                ${downloadLinks
                  .map(
                    (link) => `
                  <div style="margin: 12px 0;">
                    <a href="${link.url}" style="display: inline-block; background: ${brand.colors.primary}; color: ${brand.colors.background}; padding: 10px 24px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Download ${link.name}</a>
                  </div>
                `
                  )
                  .join("")}
                <p style="color: ${brand.colors.muted}; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">These links expire in 7 days. You can always download again from your <a href="${baseUrl}/billing" style="color: ${brand.colors.primary}; text-decoration: none;">billing page</a>.</p>
                <p style="color: ${brand.colors.muted}; font-size: 13px; line-height: 1.5; margin: 16px 0 0;">Install with: <code style="background: ${brand.colors.card}; padding: 2px 8px; border-radius: 4px; color: #e5e5e5;">npx deal-room skill:install ./package.skill</code></p>
              </div>
              <div style="padding: 16px 24px; border-top: 1px solid ${brand.colors.border};">
                <p style="color: #666666; font-size: 11px; margin: 0;">${brand.company}&#8482; &middot; DEALROOM &middot; <a href="https://${brand.appDomain}" style="color: ${brand.colors.primary}; text-decoration: none;">${brand.appDomain}</a></p>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        logger.error("Failed to send download email", { err: String(emailErr) });
      }
    }
  }
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
      logger.error("Customer not found for subscription", { subscriptionId: subscription.id });
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

  logger.info("Expired entitlements for customer", {
    customerId: customer.id,
    skillPackageIds,
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Only process subscription invoices
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  if (!subscriptionRef) return;

  const subscriptionId =
    typeof subscriptionRef === "string"
      ? subscriptionRef
      : subscriptionRef.id;

  // Find entitlements linked to this subscription
  const entitlements = await prisma.skillEntitlement.findMany({
    where: { stripeSubscriptionId: subscriptionId },
    include: {
      skillPackage: true,
    },
  });

  if (!entitlements.length) return;

  const amountPaid = invoice.amount_paid; // in cents
  if (!amountPaid || amountPaid <= 0) return;

  // Split revenue per skill package
  const perSkillAmount = Math.floor(amountPaid / entitlements.length);

  for (const entitlement of entitlements) {
    const pkg = entitlement.skillPackage;
    if (!pkg.authorId) continue; // No author = no revenue share

    const authorAmount = Math.floor(perSkillAmount * pkg.revenueSharePct / 100);
    const platformAmount = perSkillAmount - authorAmount;

    // Create revenue event
    await prisma.revenueEvent.create({
      data: {
        skillPackageId: pkg.id,
        authorId: pkg.authorId,
        eventType: "SUBSCRIPTION_PAYMENT",
        grossAmount: perSkillAmount,
        platformAmount,
        authorAmount,
        currency: (invoice.currency || "eur").toLowerCase(),
      },
    });

    // Attempt Stripe Connect transfer if author has connected account
    if (authorAmount > 0) {
      const authorProfile = await prisma.lawyerProfile.findFirst({
        where: { userId: pkg.authorId },
      });

      if (authorProfile?.stripeConnectAccountId) {
        try {
          const { createConnectTransfer } = await import("@/lib/stripe");
          const transfer = await createConnectTransfer({
            amount: authorAmount,
            currency: (invoice.currency || "eur").toLowerCase(),
            destinationAccountId: authorProfile.stripeConnectAccountId,
            description: `Revenue share: ${pkg.displayName}`,
            metadata: {
              skillPackageId: pkg.id,
              authorId: pkg.authorId,
              invoiceId: invoice.id,
            },
          });

          await prisma.revenueEvent.updateMany({
            where: {
              skillPackageId: pkg.id,
              authorId: pkg.authorId,
              eventType: "SUBSCRIPTION_PAYMENT",
              stripeTransferId: null,
              createdAt: { gte: new Date(Date.now() - 60_000) },
            },
            data: {
              stripeTransferId: transfer.id,
              settledAt: new Date(),
            },
          });
        } catch (err) {
          logger.error("Failed Stripe Connect transfer for author", {
            authorId: pkg.authorId,
            err: String(err),
          });
        }
      }
    }
  }
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

  logger.info("Suspended entitlements for customer due to payment failure", {
    customerId: customer.id,
  });

  if (customer.email) {
    try {
      await getResend().emails.send({
        from: process.env.EMAIL_FROM || `noreply@${brand.domain}`,
        to: customer.email,
        subject: "DEALROOM — Payment Failed",
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: ${brand.colors.background}; border-radius: 12px; overflow: hidden;">
            <div style="padding: 24px 24px 16px; border-bottom: 1px solid ${brand.colors.border};">
              <span style="font-size: 20px; font-weight: 700; color: ${brand.colors.foreground}; letter-spacing: 0.05em;">DEALROOM</span>
            </div>
            <div style="padding: 32px 24px;">
              <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">We were unable to process your latest payment. Your premium features have been temporarily suspended.</p>
              <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Please update your payment method to restore access.</p>
              <a href="${process.env.NEXTAUTH_URL}/billing" style="display: inline-block; background: ${brand.colors.primary}; color: ${brand.colors.background}; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Update Payment Method</a>
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid ${brand.colors.border};">
              <p style="color: #666666; font-size: 11px; margin: 0;">${brand.company}&#8482; &middot; DEALROOM &middot; <a href="https://${brand.appDomain}" style="color: ${brand.colors.primary}; text-decoration: none;">${brand.appDomain}</a></p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      logger.error("Failed to send payment failure email", { err: String(emailErr) });
    }
  }
}
