// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — Accept Deal
 *
 * POST /api/v1/agent/deals/:id/accept
 * Accept the current deal terms (async mode).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { withIdempotency } from "@/server/middleware/idempotency";
import { features } from "@/config/features";
import { fireWebhook } from "@/server/services/agent/webhooks";
import { createLogger } from "@/lib/logger";

const logger = createLogger("agent-api");

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

    return await withIdempotency(req, auth.customer.id, async () => {
    const { id } = await params;

    const agentDeal = await prisma.agentDealRoom.findUnique({
      where: { id },
      include: {
        dealRoom: {
          include: {
            parties: true,
            clauses: {
              include: {
                compromiseSuggestions: {
                  orderBy: { roundNumber: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
        dispute: true,
      },
    });

    if (!agentDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const isInitiator = agentDeal.initiatorCustomerId === auth.customer.id;
    const isRespondent = agentDeal.respondentCustomerId === auth.customer.id;
    if (!isInitiator && !isRespondent) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Once a deal is at Gavel, accepting it would conflict with the
    // arbitration — refuse and let the dispute resolve.
    if (agentDeal.dispute) {
      return NextResponse.json(
        {
          error: "This deal is under dispute and cannot be accepted until the dispute resolves.",
          disputeId: agentDeal.dispute.id,
          gavelCaseId: agentDeal.dispute.gavelCaseId,
          status: agentDeal.dispute.status,
        },
        { status: 409 }
      );
    }

    if (agentDeal.status === "FAILED") {
      return NextResponse.json(
        { error: "Cannot accept a failed deal" },
        { status: 409 }
      );
    }

    if (!agentDeal.dealRoom) {
      return NextResponse.json(
        { error: "Deal has not been negotiated yet" },
        { status: 400 }
      );
    }

    // Update party status to ACCEPTED
    const partyRole = isInitiator ? "INITIATOR" : "RESPONDENT";
    const party = agentDeal.dealRoom.parties.find((p) => p.role === partyRole);
    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    await prisma.dealRoomParty.update({
      where: { id: party.id },
      data: { status: "ACCEPTED" },
    });

    // Check if both parties have accepted
    const otherParty = agentDeal.dealRoom.parties.find((p) => p.role !== partyRole);
    const bothAccepted = otherParty?.status === "ACCEPTED";

    if (bothAccepted) {
      // Move deal to AGREED
      await prisma.dealRoom.update({
        where: { id: agentDeal.dealRoom.id },
        data: { status: "AGREED" },
      });

      await prisma.agentDealRoom.update({
        where: { id: agentDeal.id },
        data: { status: "AGREED", resolvedAt: new Date() },
      });

      // Fire agreed webhooks
      const webhookData = {
        agentDealRoomId: agentDeal.id,
        dealRoomId: agentDeal.dealRoomId,
        status: "AGREED",
      };
      fireWebhook(agentDeal.initiatorCustomerId, "negotiation.agreed", webhookData).catch(() => {});
      if (agentDeal.respondentCustomerId) {
        fireWebhook(agentDeal.respondentCustomerId, "negotiation.agreed", webhookData).catch(() => {});
      }
    }

    return NextResponse.json({
      accepted: true,
      bothAccepted,
      status: bothAccepted ? "AGREED" : "PENDING_ACCEPTANCE",
    });
    });
  } catch (error) {
    logger.error("Error accepting deal", { err: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
