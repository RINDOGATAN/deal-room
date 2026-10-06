// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { getLocale, getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { resolveVisitorCurrencyFromHeaders } from "@/lib/currency";
import { preferredCurrency } from "@/lib/contract-billing";
import { features } from "@/config/features";
import { brand } from "@/config/brand";
import { loadPricingFacts } from "@/server/services/billing/pricing-facts";
import { pricingJsonLd } from "@/lib/pricing-page";
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

/** A signed-in customer's stored billing currency, if any (never fails the page). */
async function storedCurrency(): Promise<unknown> {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return undefined;
    const customer = await prisma.customer.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { metadata: true },
    });
    return preferredCurrency(customer?.metadata);
  } catch {
    return undefined;
  }
}

export default async function PricingPage() {
  const locale = await getLocale();
  const billingOn = features.stripeEnabled;
  const facts = await loadPricingFacts(locale);
  const currency = resolveVisitorCurrencyFromHeaders(
    await headers(),
    billingOn ? await storedCurrency() : undefined,
  );
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
      <PricingView facts={facts} billingOn={billingOn} currency={currency} />
    </div>
  );
}
