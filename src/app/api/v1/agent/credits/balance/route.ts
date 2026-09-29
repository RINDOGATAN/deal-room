// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — contract credit balance
 *
 * GET /api/v1/agent/credits/balance
 * The key's remaining credits, whether the customer's monthly plan is
 * active, and the latest ledger entries (purchases, contracts, reversals).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { features } from "@/config/features";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { apiError } from "@/lib/api-response";
import { activePlanFor } from "@/server/services/billing/deal-entitlement";

export async function GET(req: NextRequest) {
  try {
    if (!features.agentApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    const auth = await authenticateApiKey(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      requireScope(auth, "billing:read");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    if (!features.stripeEnabled) {
      return NextResponse.json({ billing: "off", balance: null, planActive: false, entries: [] });
    }

    const [credit, plan] = await Promise.all([
      prisma.agentCredit.findUnique({
        where: { apiKeyId: auth.apiKey.id },
        include: { entries: { orderBy: { createdAt: "desc" }, take: 20 } },
      }),
      activePlanFor(auth.customer.id),
    ]);

    return NextResponse.json({
      billing: "per_contract",
      apiKeyId: auth.apiKey.id,
      balance: credit?.balance ?? 0,
      planActive: !!plan,
      planPeriodEnd: plan?.currentPeriodEnd ?? null,
      entries: (credit?.entries ?? []).map((e) => ({
        delta: e.delta,
        reason: e.reason,
        dealRoomId: e.dealRoomId,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    return apiError(error, "Failed to read the credit balance");
  }
}
