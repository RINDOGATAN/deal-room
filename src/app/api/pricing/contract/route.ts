// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GET /api/pricing/contract?locale=en|es
 *
 * Public. The display price of one contract in each currency, for the
 * price line of the static contract guide pages (the browser picks the
 * visitor's one currency). Read from the price configuration only, like
 * /pricing; `billing: false` when payments are off on this deployment.
 */

import { NextRequest, NextResponse } from "next/server";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";
import { displayPrice } from "@/lib/contract-billing";
import { getPriceTable } from "@/server/services/billing/pricing";

export async function GET(req: NextRequest) {
  try {
    if (!features.stripeEnabled) {
      return NextResponse.json({ billing: false, contract: null });
    }
    const locale = req.nextUrl.searchParams.get("locale") === "es" ? "es" : "en";
    const table = await getPriceTable();
    const shown = (currency: "usd" | "eur") =>
      displayPrice("contract", currency, { stripeMinor: table?.contract[currency]?.amount, locale });
    return NextResponse.json(
      { billing: true, contract: { usd: shown("usd"), eur: shown("eur") } },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=600" } },
    );
  } catch (error) {
    return apiError(error, "Could not read the price");
  }
}
