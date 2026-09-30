// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — contract credit balance
 *
 * GET /api/v1/agent/credits/balance
 * The remaining credits of the key's customer (shared by all of its keys)
 * and the latest ledger entries (purchases, contracts, reversals), each
 * with the key that bought or spent it.
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
      return NextResponse.json({ billing: "off", balance: null, entries: [] });
    }

    const credit = await prisma.customerCredit.findUnique({
      where: { customerId: auth.customer.id },
      include: { entries: { orderBy: { createdAt: "desc" }, take: 20 } },
    });

    return NextResponse.json({
      billing: "per_contract",
      heldBy: "customer",
      customerId: auth.customer.id,
      balance: credit?.balance ?? 0,
      entries: (credit?.entries ?? []).map((e) => ({
        delta: e.delta,
        reason: e.reason,
        dealRoomId: e.dealRoomId,
        apiKeyId: e.apiKeyId,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    return apiError(error, "Failed to read the credit balance");
  }
}
