/**
 * Agent API — Reject Deal
 *
 * POST /api/v1/agent/deals/:id/reject
 * Reject the deal (async mode). Moves status to FAILED.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { features } from "@/config/features";
import { fireWebhook } from "@/server/services/agent/webhooks";

export async function POST(
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
      requireScope(auth, "negotiate");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason } = body as { reason?: string };

    const agentDeal = await prisma.agentDealRoom.findUnique({
      where: { id },
    });

    if (!agentDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const isInitiator = agentDeal.initiatorCustomerId === auth.customer.id;
    const isRespondent = agentDeal.respondentCustomerId === auth.customer.id;
    if (!isInitiator && !isRespondent) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (agentDeal.status === "FAILED") {
      return NextResponse.json(
        { error: "Deal is already failed" },
        { status: 409 }
      );
    }

    const rejectReason = reason || `Rejected by ${isInitiator ? "initiator" : "respondent"}`;

    await prisma.agentDealRoom.update({
      where: { id },
      data: {
        status: "FAILED",
        failureReason: rejectReason,
        resolvedAt: new Date(),
      },
    });

    if (agentDeal.dealRoomId) {
      await prisma.dealRoom.update({
        where: { id: agentDeal.dealRoomId },
        data: { status: "CANCELLED" },
      });
    }

    // Fire webhook events
    const webhookData = {
      agentDealRoomId: agentDeal.id,
      status: "FAILED",
      failureReason: rejectReason,
    };
    fireWebhook(agentDeal.initiatorCustomerId, "negotiation.failed", webhookData).catch(() => {});
    if (agentDeal.respondentCustomerId) {
      fireWebhook(agentDeal.respondentCustomerId, "negotiation.failed", webhookData).catch(() => {});
    }

    return NextResponse.json({ rejected: true, reason: rejectReason });
  } catch (error) {
    console.error("Error rejecting deal:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
