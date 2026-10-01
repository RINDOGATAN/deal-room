// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { features } from "@/config/features";
import { brand } from "@/config/brand";
import { getPriceTable } from "@/server/services/billing/pricing";
import { pricingFacts, pricingJsonLd, type MinorAmounts } from "@/lib/pricing-page";
import { PricingView } from "@/components/pricing/PricingView";

// Amounts and the start date are read from the environment and Stripe per
// request (the price table is cached for ten minutes), never at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: { canonical: "/pricing" },
  };
}

async function minorAmounts(): Promise<MinorAmounts | null> {
  if (!features.stripeEnabled) return null;
  try {
    const table = await getPriceTable();
    if (!table) return null;
    return {
      contract: { usd: table.contract.usd?.amount ?? null, eur: table.contract.eur?.amount ?? null },
      credits10: { usd: table.credits10.usd?.amount ?? null, eur: table.credits10.eur?.amount ?? null },
    };
  } catch {
    // Without the Stripe amounts the page still renders, from
    // PRICE_DISPLAY_* when set, otherwise with no number.
    return null;
  }
}

export default async function PricingPage() {
  const locale = await getLocale();
  const billingOn = features.stripeEnabled;
  const facts = pricingFacts({ minor: await minorAmounts(), locale });
  const jsonLd = billingOn ? pricingJsonLd(facts, `https://dealroom.${brand.domain}/pricing`) : null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {jsonLd && (
        <script
          type="application/ld+json"
          // `<` escaped so no value can close the script element.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      <PricingView facts={facts} billingOn={billingOn} />
    </div>
  );
}
