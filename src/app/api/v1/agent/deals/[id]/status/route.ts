/**
 * Agent API — Deal Status
 *
 * GET /api/v1/agent/deals/:id/status
 * Lightweight status polling endpoint for async negotiations.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { features } from "@/config/features";
import { createLogger } from "@/lib/logger";

const logger = createLogger("agent-api");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!features.agentApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    const auth = await authenticateApiKey(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requireScope(auth, "deals:read");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const { id } = await params;

    const agentDeal = await prisma.agentDealRoom.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        failureReason: true,
        resolvedAt: true,
        dealRoomId: true,
        initiatorCustomerId: true,
        respondentCustomerId: true,
        dealRoom: {
          select: {
            currentRound: true,
            parties: {
              select: { role: true, status: true },
            },
          },
        },
      },
    });

    if (!agentDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Verify customer is a party
    if (
      agentDeal.initiatorCustomerId !== auth.customer.id &&
      agentDeal.respondentCustomerId !== auth.customer.id
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({
      id: agentDeal.id,
      status: agentDeal.status,
      dealRoomId: agentDeal.dealRoomId,
      failureReason: agentDeal.failureReason,
      resolvedAt: agentDeal.resolvedAt,
      currentRound: agentDeal.dealRoom?.currentRound ?? 0,
      parties: agentDeal.dealRoom?.parties.map((p) => ({
        role: p.role,
        status: p.status,
      })),
    });
  } catch (error) {
    logger.error("Error getting deal status", { err: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
