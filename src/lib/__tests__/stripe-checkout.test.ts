// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Pay-per-contract checkout: every payment produces an invoice the buyer
 * can book, and no tax is calculated (the tax decision is pending).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/features", () => ({ features: { stripeEnabled: true } }));

const retrieve = vi.hoisted(() => vi.fn());
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { retrieve } };
  },
}));

import {
  buildBillingCheckoutParams,
  getCheckoutInvoiceLinks,
  getInvoiceLinksForSessions,
  invoiceSellerFooter,
} from "@/lib/stripe";

const base = {
  mode: "payment" as const,
  priceId: "price_contract_eur",
  stripeCustomerId: "cus_1",
  metadata: { kind: "contract", dealRoomId: "deal_1", customerId: "cust_1", userId: "user_1" },
  successUrl: "https://dealroom.test/deals/deal_1?paid=1",
  cancelUrl: "https://dealroom.test/deals/deal_1",
  invoiceDescription: "Dealroom contract: Supply agreement",
};

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
    expect(params.tax_id_collection).toEqual({ enabled: true });
    expect(params.customer_update).toEqual({ name: "auto", address: "auto" });
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
