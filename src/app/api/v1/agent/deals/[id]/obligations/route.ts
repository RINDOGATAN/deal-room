// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API: what a contract commits its parties to, and its dates.
 *
 * GET /api/v1/agent/deals/:id/obligations[?lang=es]
 *
 * Free (no credit). The obligations ledger (recurring and event-driven
 * duties; DPA today, `src/lib/obligations.ts`) and, for every contract
 * type, the dates and periods the deal states: date inputs, term, notice
 * and renewal inputs, and the agreed option of each term, renewal,
 * termination, notice or duration clause. Behind
 * `features.startupCoverage`.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApiKey, requireScope, ApiScopeError } from "@/server/middleware/apiKeyAuth";
import { unauthorizedResponse } from "@/server/middleware/unauthorized";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";
import { dealObligations } from "@/server/services/agent/coverage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!features.agentApi || !features.startupCoverage) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }
    const auth = await authenticateApiKey(req);
    if (!auth) return unauthorizedResponse();
    try {
      requireScope(auth, "deals:read");
    } catch (e) {
      if (e instanceof ApiScopeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    const { id } = await params;
    const lang = req.nextUrl.searchParams.get("lang") === "es" ? "es" : "en";
    const agentDeal = await prisma.agentDealRoom.findUnique({ where: { id } });
    if (
      !agentDeal ||
      (agentDeal.initiatorCustomerId !== auth.customer.id && agentDeal.respondentCustomerId !== auth.customer.id)
    ) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    if (!agentDeal.dealRoomId) {
      return NextResponse.json({ error: "This deal has no contract yet" }, { status: 409 });
    }
    const answer = await dealObligations(prisma, agentDeal.dealRoomId, lang);
    if (!answer) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    return NextResponse.json({ dealId: agentDeal.id, ...answer });
  } catch (error) {
    return apiError(error, "Could not list the obligations");
  }
}
