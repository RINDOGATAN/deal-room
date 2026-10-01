import { describe, expect, it } from "vitest";
import { buildBillingCheckoutParams, type BillingCheckoutParams } from "../stripe";

const base: BillingCheckoutParams = {
  mode: "payment",
  priceId: "price_contract_eur",
  stripeCustomerId: "cus_1",
  metadata: { kind: "contract", dealRoomId: "deal_1" },
  successUrl: "https://dealroom.test/deals/deal_1?paid=1",
  cancelUrl: "https://dealroom.test/deals/deal_1",
  locale: "es",
  currency: "eur",
};

describe("checkout parameters", () => {
  it("asks for a card and nothing else", () => {
    const p = buildBillingCheckoutParams(base);
    expect(p).not.toHaveProperty("billing_address_collection");
    expect(p).not.toHaveProperty("tax_id_collection");
    expect(p).not.toHaveProperty("invoice_creation");
    expect(p).not.toHaveProperty("customer_update");
    expect(p).not.toHaveProperty("custom_text");
    expect(p).not.toHaveProperty("automatic_tax");
  });

  it("charges the visitor's one currency at the matching price", () => {
    expect(buildBillingCheckoutParams(base)).toMatchObject({
      currency: "eur",
      line_items: [{ price: "price_contract_eur", quantity: 1 }],
    });
    expect(buildBillingCheckoutParams({ ...base, currency: "usd", priceId: "price_contract_usd" })).toMatchObject({
      currency: "usd",
      line_items: [{ price: "price_contract_usd", quantity: 1 }],
    });
  });

  it("copies the metadata onto the payment intent and keeps the language", () => {
    const p = buildBillingCheckoutParams(base);
    expect(p.metadata).toEqual(base.metadata);
    expect(p.payment_intent_data).toEqual({ metadata: base.metadata });
    expect(p.locale).toBe("es");
    expect(buildBillingCheckoutParams({ ...base, locale: undefined })).not.toHaveProperty("locale");
  });
});
