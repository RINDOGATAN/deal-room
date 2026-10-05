// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GET /api/pricing/contract?locale=en|es
 *
 * Public. The display price of one contract, and of a pack of agent
 * credits, in each currency, for the price lines of the static contract
 * guide pages and the developer quick start (the browser picks the
 * visitor's one currency). Read from the price configuration only, like
 * /pricing; `billing: false` when payments are off on this deployment.
 */

import { NextRequest, NextResponse } from "next/server";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";
import { CREDITS_PER_PACK, displayPrice } from "@/lib/contract-billing";
import { getPriceTable } from "@/server/services/billing/pricing";

export async function GET(req: NextRequest) {
  try {
    if (!features.stripeEnabled) {
      return NextResponse.json({ billing: false, contract: null });
    }
    const locale = req.nextUrl.searchParams.get("locale") === "es" ? "es" : "en";
    const table = await getPriceTable();
    const shown = (product: "contract" | "credits10", currency: "usd" | "eur") =>
      displayPrice(product, currency, { stripeMinor: table?.[product][currency]?.amount, locale });
    return NextResponse.json(
      {
        billing: true,
        contract: { usd: shown("contract", "usd"), eur: shown("contract", "eur") },
        // The pack of agent credits, for the developer quick start.
        pack: { usd: shown("credits10", "usd"), eur: shown("credits10", "eur") },
        packSize: CREDITS_PER_PACK,
      },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=600" } },
    );
  } catch (error) {
    return apiError(error, "Could not read the price");
  }
}
