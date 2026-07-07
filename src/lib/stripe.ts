// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Stripe from "stripe";
import { features } from "@/config/features";
import type { ExtendedPrismaClient } from "@/lib/prisma";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!features.stripeEnabled) {
    throw new Error("Stripe is not enabled. Set STRIPE_SECRET_KEY");
  }

  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    });
  }

  return stripeClient;
}

export interface CreateCheckoutParams {
  stripeCustomerId?: string;
  customerEmail: string;
  customerId: string;
  skillPackageIds: string[];
  lineItems: { price: string; quantity: number }[];
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    allow_promotion_codes: true,
    line_items: params.lineItems,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      customerId: params.customerId,
      skillPackageIds: params.skillPackageIds.join(","),
    },
    subscription_data: {
      metadata: {
        customerId: params.customerId,
        skillPackageIds: params.skillPackageIds.join(","),
      },
    },
  };

  if (params.stripeCustomerId) {
    sessionParams.customer = params.stripeCustomerId;
  } else {
    sessionParams.customer_email = params.customerEmail;
  }

  return stripe.checkout.sessions.create(sessionParams);
}

export async function createCustomer(params: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer> {
  const stripe = getStripe();
  return stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: params.metadata,
  });
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.cancel(subscriptionId);
}

export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function createConnectTransfer(params: {
  amount: number;
  currency: string;
  destinationAccountId: string;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Transfer> {
  const stripe = getStripe();
  return stripe.transfers.create({
    amount: params.amount,
    currency: params.currency,
    destination: params.destinationAccountId,
    description: params.description,
    metadata: params.metadata,
  });
}

export async function getOrCreateStripeCustomer(
  prisma: ExtendedPrismaClient,
  email: string,
  name?: string
): Promise<{ customerId: string; stripeCustomerId: string }> {
  let customer = await prisma.customer.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (customer?.stripeCustomerId) {
    return {
      customerId: customer.id,
      stripeCustomerId: customer.stripeCustomerId,
    };
  }

  // Create Stripe customer
  const stripeCustomer = await createCustomer({
    email,
    name,
    metadata: customer ? { customerId: customer.id } : undefined,
  });

  if (customer) {
    // Update existing customer with Stripe ID
    await prisma.customer.update({
      where: { id: customer.id },
      data: { stripeCustomerId: stripeCustomer.id },
    });
    return {
      customerId: customer.id,
      stripeCustomerId: stripeCustomer.id,
    };
  }

  // Create new deal-room Customer record
  customer = await prisma.customer.create({
    data: {
      name: name || email,
      email,
      type: "SAAS",
      stripeCustomerId: stripeCustomer.id,
    },
  });

  return {
    customerId: customer.id,
    stripeCustomerId: stripeCustomer.id,
  };
}
