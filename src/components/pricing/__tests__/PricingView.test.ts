// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The public pricing page: every amount and the billing start date come
 * from the price configuration (`PRICE_DISPLAY_*`, Stripe amounts,
 * `CONTRACT_BILLING_START`), in the visitor's one currency, in both
 * languages; the structured data keeps both currencies.
 */
import { describe, it, expect } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { PricingView } from "@/components/pricing/PricingView";
import { pricingFacts, pricingJsonLd, type PricingFacts } from "@/lib/pricing-page";
import type { Currency } from "@/lib/currency";

const ENV = {
  PRICE_DISPLAY_CONTRACT: "31",
  PRICE_DISPLAY_CREDITS_10: "232.50",
  CONTRACT_BILLING_START: "2026-10-01",
};

function render(
  facts: PricingFacts,
  billingOn = true,
  locale: "en" | "es" = "en",
  currency: Currency = "USD",
) {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider as ComponentType<Record<string, unknown>>,
      { locale, messages: locale === "es" ? es : en, timeZone: "UTC" },
      createElement(PricingView, { facts, billingOn, currency }),
    ),
  );
}

describe("pricing page", () => {
  it("renders the amounts in one currency and the billing start date from the configuration", () => {
    const html = render(pricingFacts({ locale: "en", env: ENV }));
    expect(html).toContain("$31 per contract");
    expect(html).toContain("The same $31 per contract");
    expect(html).toContain("Credits are sold in packs of 10, at 25 percent off: $232.50 a pack.");
    expect(html).not.toContain("€");
    expect(html).not.toContain("Prices in");
    expect(html).not.toContain('data-testid="currency-switch"');
    expect(html).toContain("Contracts in deals created before 1 October 2026 are not charged.");
    // The confidentiality question went with the hosted caution (2026-10-01).
    expect(html).not.toContain("Can I enter confidential information?");
    expect(html).toContain("https://www.todo.law/marketplace");
    expect(html).toContain('href="/docs/agent-api"');
  });

  it("renders euros only for a European visitor, with no switch to dollars", () => {
    const html = render(pricingFacts({ locale: "en", env: ENV }), true, "en", "EUR");
    expect(html).toContain("€31 per contract");
    expect(html).toContain("€232.50 a pack");
    expect(html).not.toContain("$");
    expect(html).not.toContain("Prices in");
  });

  it("renders in Spanish with the date in Spanish", () => {
    const html = render(pricingFacts({ locale: "es", env: ENV }), true, "es", "EUR");
    expect(html).toContain("por contrato");
    expect(html).toContain("31");
    expect(html).toContain("232,50");
    expect(html).toContain("1 de octubre de 2026");
    expect(html).not.toContain("Precios en");
    expect(html).not.toContain("$");
  });

  it("falls back to the Stripe amounts when no display amount is set", () => {
    const facts = pricingFacts({
      locale: "en",
      env: { CONTRACT_BILLING_START: "2026-10-01" },
      minor: { contract: { usd: 2900, eur: 2900 }, credits10: { usd: 21750, eur: 21750 } },
    });
    const html = render(facts);
    expect(html).toContain("$29 per contract");
    expect(html).toContain("$217.50 a pack");
  });

  it("states no number and no discount when no amount is known", () => {
    const html = render(pricingFacts({ locale: "en", env: {} }));
    expect(html).toContain("One payment per contract. The amount is shown before you pay.");
    expect(html).toContain("Credits are sold in packs of 10.");
    expect(html).not.toContain("percent off");
    expect(html).not.toContain("are not charged");
    expect(pricingJsonLd(pricingFacts({ locale: "en", env: {} }), "https://x/pricing")).toBeNull();
  });

  it("says payments are off and lists no prices when billing is off", () => {
    const html = render(pricingFacts({ locale: "en", env: ENV }), false);
    expect(html).toContain("Payments are off on this deployment. Every contract is free.");
    expect(html).not.toContain("per contract</p>");
    expect(html).not.toContain("For agents");
  });

  it("builds a Product with two offers in USD and EUR", () => {
    const ld = pricingJsonLd(pricingFacts({ locale: "en", env: ENV }), "https://dealroom.todo.law/pricing");
    const offers = (ld?.offers ?? []) as Array<{ priceSpecification: Array<Record<string, string>> }>;
    expect(ld?.["@type"]).toBe("Product");
    expect(offers).toHaveLength(2);
    expect(offers[0].priceSpecification).toEqual([
      { "@type": "UnitPriceSpecification", price: "31.00", priceCurrency: "USD", unitText: "per contract" },
      { "@type": "UnitPriceSpecification", price: "31.00", priceCurrency: "EUR", unitText: "per contract" },
    ]);
    expect(offers[1].priceSpecification.map((s) => s.price)).toEqual(["232.50", "232.50"]);
  });
});
