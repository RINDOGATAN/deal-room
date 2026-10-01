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

/** Stripe caps an invoice description and footer; keep well inside it. */
const INVOICE_TEXT_LIMIT = 500;

type Env = Record<string, string | undefined>;

/**
 * The seller's legal name and address for the invoice footer, from
 * `INVOICE_SELLER_NAME` and `INVOICE_SELLER_ADDRESS`. Either may be unset;
 * with both unset there is no footer.
 */
export function invoiceSellerFooter(env: Env = process.env): string | undefined {
  const lines = [env.INVOICE_SELLER_NAME, env.INVOICE_SELLER_ADDRESS]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v);
  return lines.length ? lines.join("\n").slice(0, INVOICE_TEXT_LIMIT) : undefined;
}

export interface BillingCheckoutParams {
  mode: "payment";
  priceId: string;
  stripeCustomerId: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  locale?: "en" | "es";
  /** What the invoice is for: the deal's name, or the credit pack. */
  invoiceDescription: string;
}

/**
 * The Checkout session parameters. Every payment produces an invoice the
 * buyer can book: billing address required, tax id offered, and both saved
 * on the Stripe customer (`customer_update`, which Stripe requires for an
 * existing customer with tax id collection). No tax is calculated here:
 * `automatic_tax` stays off until the tax decision is made.
 */
export function buildBillingCheckoutParams(
  params: BillingCheckoutParams,
  env: Env = process.env,
): Stripe.Checkout.SessionCreateParams {
  const footer = invoiceSellerFooter(env);
  return {
    mode: params.mode,
    customer: params.stripeCustomerId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
    ...(params.locale ? { locale: params.locale } : {}),
    payment_intent_data: { metadata: params.metadata },
    invoice_creation: {
      enabled: true,
      invoice_data: {
        description: params.invoiceDescription.slice(0, INVOICE_TEXT_LIMIT),
        ...(footer ? { footer } : {}),
        metadata: params.metadata,
      },
    },
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: { name: "auto", address: "auto" },
  };
}

/**
 * Hosted checkout for pay per contract: a contract or a credit pack, both
 * one-off payments. The metadata (`kind` plus the deal id or the customer
 * id) is copied onto the payment intent and the invoice, so refunds can be
 * traced back without a lookup.
 */
export async function createBillingCheckout(params: BillingCheckoutParams): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.create(buildBillingCheckoutParams(params));
}

export async function retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.retrieve(sessionId);
}

export interface InvoiceLinks {
  invoiceId: string;
  number: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

/**
 * The invoice of a paid checkout, read from Stripe on demand (no invoice
 * id is stored). Null for a session without an invoice: those opened
 * before invoices were switched on, or one Stripe cannot find.
 */
export async function getCheckoutInvoiceLinks(sessionId: string): Promise<InvoiceLinks | null> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ["invoice"] });
  const invoice = session.invoice;
  if (!invoice || typeof invoice === "string") return null;
  return {
    invoiceId: invoice.id,
    number: invoice.number ?? null,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdf: invoice.invoice_pdf ?? null,
  };
}

/**
 * Invoice links for a list of checkout sessions, fetched in parallel. A
 * lookup that fails leaves that entry null rather than failing the list.
 */
export async function getInvoiceLinksForSessions(
  sessionIds: (string | null)[],
): Promise<(InvoiceLinks | null)[]> {
  return Promise.all(
    sessionIds.map((id) => (id ? getCheckoutInvoiceLinks(id).catch(() => null) : Promise.resolve(null))),
  );
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
