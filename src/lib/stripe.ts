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

/**
 * EU and EEA country codes, as Stripe writes a billing address (ISO 3166-1,
 * so Greece is GR). The reverse-charge note is printed only for these.
 */
export const EU_EEA_COUNTRIES: ReadonlySet<string> = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "IS", "LI", "NO",
]);

export const REVERSE_CHARGE_NOTE =
  "Reverse charge: VAT to be accounted for by the recipient (Article 196, Council Directive 2006/112/EC).";

/**
 * Shown on the Stripe checkout page, above the pay button. Dealroom is sold
 * to businesses and professionals only (owner, 1 October 2026); European
 * buyers are also told they give their VAT number.
 */
const CHECKOUT_BUSINESS_TEXT = {
  en: {
    all: "Dealroom is sold to businesses and professionals. Prices exclude any VAT or sales tax.",
    europe:
      "Dealroom is sold to businesses and professionals. Prices exclude any VAT or sales tax; European buyers give their VAT number at checkout.",
  },
  es: {
    all: "Dealroom se vende a empresas y profesionales. Los precios no incluyen IVA ni impuestos sobre las ventas.",
    europe:
      "Dealroom se vende a empresas y profesionales. Los precios no incluyen IVA ni impuestos sobre las ventas; los compradores europeos indican su número de IVA al pagar.",
  },
} as const;

/** The buyer details Stripe records on a completed checkout. */
export interface BuyerDetails {
  address?: { country?: string | null } | null;
  tax_ids?: { value?: string | null }[] | null;
}

/**
 * Reverse charge applies when the buyer's billing address is in the EU or
 * EEA and a VAT number was given. Anywhere else, no tax line at all.
 */
export function reverseChargeApplies(buyer: BuyerDetails | null | undefined): boolean {
  const country = (buyer?.address?.country ?? "").trim().toUpperCase();
  if (!EU_EEA_COUNTRIES.has(country)) return false;
  return (buyer?.tax_ids ?? []).some((id) => !!id.value?.trim());
}

/**
 * The full invoice footer for a buyer: the seller lines, then the
 * reverse-charge note when it applies. Undefined when there is neither.
 */
export function invoiceFooterFor(buyer: BuyerDetails | null | undefined, env: Env = process.env): string | undefined {
  const seller = invoiceSellerFooter(env);
  if (!reverseChargeApplies(buyer)) return seller;
  return seller ? `${seller}\n${REVERSE_CHARGE_NOTE}` : REVERSE_CHARGE_NOTE;
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
  /**
   * The checkout currency. Euros mean a European buyer: the tax id becomes
   * required where Stripe supports one for the billing country.
   */
  currency: "usd" | "eur";
}

/**
 * The Checkout session parameters. Every payment produces an invoice the
 * buyer can book: billing address required, tax id collected, and both
 * saved on the Stripe customer (`customer_update`, which Stripe requires for
 * an existing customer with tax id collection). Dealroom is sold to
 * businesses only, so a buyer paying in euros must give a tax id when their
 * billing country has one (EU VAT numbers included); a buyer paying in
 * dollars may give one and is never blocked. No tax is calculated:
 * `automatic_tax` stays off. The reverse-charge note is added to the
 * invoice after payment, once the address and VAT number are known
 * (`addReverseChargeNote`).
 */
export function buildBillingCheckoutParams(
  params: BillingCheckoutParams,
  env: Env = process.env,
): Stripe.Checkout.SessionCreateParams {
  const footer = invoiceSellerFooter(env);
  const europe = params.currency === "eur";
  const text = CHECKOUT_BUSINESS_TEXT[params.locale ?? "en"];
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
    tax_id_collection: europe ? { enabled: true, required: "if_supported" } : { enabled: true },
    customer_update: { name: "auto", address: "auto" },
    custom_text: { submit: { message: europe ? text.europe : text.all } },
  };
}

/**
 * After payment: when the buyer's billing address is in the EU or EEA and
 * a VAT number was given, add the reverse-charge note to the session's
 * invoice footer. Stripe keeps the footer editable on a paid invoice.
 * Returns true when the invoice was updated. Writing the same footer twice
 * is harmless, so the webhook and the return from checkout may both call it.
 */
export async function addReverseChargeNote(session: Stripe.Checkout.Session): Promise<boolean> {
  if (!reverseChargeApplies(session.customer_details)) return false;
  const invoice = session.invoice;
  const invoiceId = typeof invoice === "string" ? invoice : invoice?.id;
  if (!invoiceId) return false;
  const footer = invoiceFooterFor(session.customer_details);
  if (!footer) return false;
  await getStripe().invoices.update(invoiceId, { footer });
  return true;
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
