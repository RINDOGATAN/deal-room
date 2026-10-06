// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API: a small public calendar of statutory dates.
 *
 * GET /api/v1/agent/deadlines[?grantDate=YYYY-MM-DD][&firstSaleDate=YYYY-MM-DD][&year=YYYY][&lang=es]
 *
 * Public (no key) and free. The 83(b) election (30 days after the
 * transfer), the Form D notice (15 calendar days after the first sale)
 * and the Delaware annual report and franchise tax (1 March), each with
 * its official source and marked "Verify with the official source." Due
 * dates are counted only from the dates given. See
 * `src/lib/statutory-deadlines.ts`. Behind `features.startupCoverage`.
 */

import { NextRequest, NextResponse } from "next/server";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";
import { buildDeadlines, parseIsoDate } from "@/lib/statutory-deadlines";

export async function GET(req: NextRequest) {
  try {
    if (!features.agentApi || !features.startupCoverage) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }
    const sp = req.nextUrl.searchParams;
    const lang = sp.get("lang") === "es" ? "es" : "en";
    const grantDate = sp.get("grantDate") || null;
    const firstSaleDate = sp.get("firstSaleDate") || null;
    const yearRaw = sp.get("year");
    for (const [name, value] of [["grantDate", grantDate], ["firstSaleDate", firstSaleDate]] as const) {
      if (value && !parseIsoDate(value)) {
        return NextResponse.json({ error: `${name} must be a date as YYYY-MM-DD` }, { status: 400 });
      }
    }
    const year = yearRaw ? Number(yearRaw) : null;
    if (yearRaw && (!Number.isInteger(year) || year! < 2000 || year! > 2100)) {
      return NextResponse.json({ error: "year must be a year such as 2027" }, { status: 400 });
    }
    return NextResponse.json(buildDeadlines({ locale: lang, grantDate, firstSaleDate, year }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error, "Could not list the deadlines");
  }
}
