// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Pay-per-contract checkout: every payment produces an invoice the buyer
 * can book, and no tax is calculated (the tax decision is pending).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/features", () => ({ features: { stripeEnabled: true } }));

const retrieve = vi.hoisted(() => vi.fn());
const updateInvoice = vi.hoisted(() => vi.fn());
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { retrieve } };
    invoices = { update: updateInvoice };
  },
}));

import type Stripe from "stripe";
import {
  REVERSE_CHARGE_NOTE,
  addReverseChargeNote,
  buildBillingCheckoutParams,
  getCheckoutInvoiceLinks,
  getInvoiceLinksForSessions,
  invoiceFooterFor,
  invoiceSellerFooter,
  reverseChargeApplies,
} from "@/lib/stripe";

const base = {
  mode: "payment" as const,
  priceId: "price_contract_eur",
  stripeCustomerId: "cus_1",
  metadata: { kind: "contract", dealRoomId: "deal_1", customerId: "cust_1", userId: "user_1" },
  successUrl: "https://dealroom.test/deals/deal_1?paid=1",
  cancelUrl: "https://dealroom.test/deals/deal_1",
  invoiceDescription: "Dealroom contract: Supply agreement",
  currency: "eur" as const,
};

const submitMessage = (params: Stripe.Checkout.SessionCreateParams) =>
  (params.custom_text?.submit as { message?: string } | undefined)?.message;

const SELLER ={ INVOICE_SELLER_NAME: "Seller Ltd", INVOICE_SELLER_ADDRESS: "1 Example Street" };

describe("buildBillingCheckoutParams", () => {
  it("creates an invoice, requires the billing address, offers the tax id and saves both", () => {
    const params = buildBillingCheckoutParams(base, {});
    expect(params.invoice_creation).toEqual({
      enabled: true,
      invoice_data: {
        description: "Dealroom contract: Supply agreement",
        metadata: base.metadata,
      },
    });
    expect(params.billing_address_collection).toBe("required");
    expect(params.customer_update).toEqual({ name: "auto", address: "auto" });
  });

  it("paying in euros: the tax id is required where the country has one, and the page says so", () => {
    const params = buildBillingCheckoutParams(base, {});
    expect(params.tax_id_collection).toEqual({ enabled: true, required: "if_supported" });
    expect(params.billing_address_collection).toBe("required");
    expect(submitMessage(params)).toBe(
      "Dealroom is sold to businesses and professionals. Prices exclude any VAT or sales tax; European buyers give their VAT number at checkout.",
    );
  });

  it("paying in dollars: the tax id is offered but never blocks the buyer", () => {
    const params = buildBillingCheckoutParams({ ...base, currency: "usd" }, {});
    expect(params.tax_id_collection).toEqual({ enabled: true });
    expect(params.billing_address_collection).toBe("required");
    expect(submitMessage(params)).toBe(
      "Dealroom is sold to businesses and professionals. Prices exclude any VAT or sales tax.",
    );
  });

  it("the checkout note follows the checkout language", () => {
    const params = buildBillingCheckoutParams({ ...base, locale: "es" }, {});
    expect(submitMessage(params)).toBe(
      "Dealroom se vende a empresas y profesionales. Los precios no incluyen IVA ni impuestos sobre las ventas; los compradores europeos indican su número de IVA al pagar.",
    );
  });

  it("the footer set at checkout never carries the reverse-charge note (the buyer is not known yet)", () => {
    const params = buildBillingCheckoutParams(base, SELLER);
    expect(params.invoice_creation?.invoice_data?.footer).toBe("Seller Ltd\n1 Example Street");
  });

  it("never enables automatic tax", () => {
    const params = buildBillingCheckoutParams(base, {
      INVOICE_SELLER_NAME: "Seller Ltd",
      INVOICE_SELLER_ADDRESS: "1 Example Street",
    });
    expect(params).not.toHaveProperty("automatic_tax");
  });

  it("keeps the price, quantity and metadata as before", () => {
    const params = buildBillingCheckoutParams({ ...base, locale: "es" }, {});
    expect(params.line_items).toEqual([{ price: "price_contract_eur", quantity: 1 }]);
    expect(params.payment_intent_data).toEqual({ metadata: base.metadata });
    expect(params.locale).toBe("es");
  });

  it("puts the seller's name and address in the footer when configured", () => {
    const params = buildBillingCheckoutParams(base, {
      INVOICE_SELLER_NAME: "Seller Ltd",
      INVOICE_SELLER_ADDRESS: "1 Example Street, Example City",
    });
    expect(params.invoice_creation?.invoice_data?.footer).toBe("Seller Ltd\n1 Example Street, Example City");
  });
});

describe("invoiceSellerFooter", () => {
  it("is omitted when neither variable is set", () => {
    expect(invoiceSellerFooter({})).toBeUndefined();
    expect(invoiceSellerFooter({ INVOICE_SELLER_NAME: "  " })).toBeUndefined();
  });

  it("uses whichever part is set", () => {
    expect(invoiceSellerFooter({ INVOICE_SELLER_NAME: "Seller Ltd" })).toBe("Seller Ltd");
  });
});

describe("reverse-charge footer rule", () => {
  const spainWithVat = { address: { country: "ES" }, tax_ids: [{ type: "eu_vat", value: "ESB12345678" }] };

  it("EU address with a VAT number: seller lines, then the note", () => {
    expect(reverseChargeApplies(spainWithVat)).toBe(true);
    expect(invoiceFooterFor(spainWithVat, SELLER)).toBe(`Seller Ltd\n1 Example Street\n${REVERSE_CHARGE_NOTE}`);
    expect(REVERSE_CHARGE_NOTE).toBe(
      "Reverse charge: VAT to be accounted for by the recipient (Article 196, Council Directive 2006/112/EC).",
    );
  });

  it("EEA outside the EU counts too; the note stands alone without seller lines", () => {
    const norway = { address: { country: "no" }, tax_ids: [{ type: "no_vat", value: "123456789MVA" }] };
    expect(invoiceFooterFor(norway, {})).toBe(REVERSE_CHARGE_NOTE);
  });

  it("US buyer: no tax line, with or without a tax id", () => {
    expect(invoiceFooterFor({ address: { country: "US" }, tax_ids: [] }, SELLER)).toBe("Seller Ltd\n1 Example Street");
    expect(invoiceFooterFor({ address: { country: "US" }, tax_ids: [{ value: "12-3456789" }] }, SELLER)).toBe(
      "Seller Ltd\n1 Example Street",
    );
  });

  it("United Kingdom and Switzerland are not EU or EEA: no tax line", () => {
    expect(reverseChargeApplies({ address: { country: "GB" }, tax_ids: [{ value: "GB123456789" }] })).toBe(false);
    expect(reverseChargeApplies({ address: { country: "CH" }, tax_ids: [{ value: "CHE-123.456.789" }] })).toBe(false);
  });

  it("no note without a VAT number (a euro checkout requires one, so this is a dollar checkout)", () => {
    expect(reverseChargeApplies({ address: { country: "ES" }, tax_ids: [] })).toBe(false);
    expect(reverseChargeApplies({ address: { country: "ES" }, tax_ids: [{ value: " " }] })).toBe(false);
    expect(reverseChargeApplies(null)).toBe(false);
  });
});

describe("addReverseChargeNote", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("INVOICE_SELLER_NAME", "Seller Ltd");
    vi.stubEnv("INVOICE_SELLER_ADDRESS", "1 Example Street");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    updateInvoice.mockReset();
  });

  const session = (details: unknown, invoice: unknown = "in_1") =>
    ({ id: "cs_1", invoice, customer_details: details }) as unknown as Stripe.Checkout.Session;

  it("writes the footer on the paid invoice for an EU buyer with a VAT number", async () => {
    const done = await addReverseChargeNote(
      session({ address: { country: "FR" }, tax_ids: [{ type: "eu_vat", value: "FR12345678901" }] }),
    );
    expect(done).toBe(true);
    expect(updateInvoice).toHaveBeenCalledWith("in_1", {
      footer: `Seller Ltd\n1 Example Street\n${REVERSE_CHARGE_NOTE}`,
    });
  });

  it("leaves a US buyer's invoice alone", async () => {
    expect(await addReverseChargeNote(session({ address: { country: "US" }, tax_ids: [] }))).toBe(false);
    expect(updateInvoice).not.toHaveBeenCalled();
  });

  it("does nothing for a session without an invoice", async () => {
    const eu = { address: { country: "DE" }, tax_ids: [{ value: "DE123456789" }] };
    expect(await addReverseChargeNote(session(eu, null))).toBe(false);
    expect(updateInvoice).not.toHaveBeenCalled();
  });
});

describe("invoice links on demand", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    retrieve.mockReset();
  });

  it("reads the hosted page and PDF of the session's invoice", async () => {
    retrieve.mockResolvedValue({
      id: "cs_1",
      invoice: { id: "in_1", number: "ABC-0001", hosted_invoice_url: "https://invoice.test/i", invoice_pdf: "https://invoice.test/p" },
    });
    expect(await getCheckoutInvoiceLinks("cs_1")).toEqual({
      invoiceId: "in_1",
      number: "ABC-0001",
      hostedInvoiceUrl: "https://invoice.test/i",
      invoicePdf: "https://invoice.test/p",
    });
    expect(retrieve).toHaveBeenCalledWith("cs_1", { expand: ["invoice"] });
  });

  it("is null for an older session without an invoice", async () => {
    retrieve.mockResolvedValue({ id: "cs_old", invoice: null });
    expect(await getCheckoutInvoiceLinks("cs_old")).toBeNull();
  });

  it("a failed lookup leaves only that entry empty", async () => {
    retrieve
      .mockRejectedValueOnce(new Error("No such checkout session"))
      .mockResolvedValueOnce({ id: "cs_2", invoice: { id: "in_2", number: null, hosted_invoice_url: "https://invoice.test/2", invoice_pdf: null } });
    const links = await getInvoiceLinksForSessions(["cs_gone", null, "cs_2"]);
    expect(links[0]).toBeNull();
    expect(links[1]).toBeNull();
    expect(links[2]?.hostedInvoiceUrl).toBe("https://invoice.test/2");
  });
});
