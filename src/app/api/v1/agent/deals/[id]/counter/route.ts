// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — Submit Counter-Proposals
 *
 * POST /api/v1/agent/deals/:id/counter
 * Submit counter-proposals for specific clauses in an async negotiation.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
  checkRateLimit,
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

    // Mirror the rate-limit posture of negotiate/route.ts. Without this,
    // an agent could spam unlimited counter-rounds in a single negotiation.
    const rateLimit = await checkRateLimit(auth.customer.id, "negotiate");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfter) },
        }
      );
    }

    return await withIdempotency(req, auth.customer.id, async () => {
    const { id } = await params;
    const body = await req.json();
    const { proposals } = body;

    if (!Array.isArray(proposals) || proposals.length === 0) {
      return NextResponse.json(
        { error: "proposals array is required" },
        { status: 400 }
      );
    }

    const agentDeal = await prisma.agentDealRoom.findUnique({
      where: { id },
      include: {
        dealRoom: { include: { parties: true, clauses: true } },
        dispute: true,
      },
    });

    if (!agentDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Verify customer is a party
    const isInitiator = agentDeal.initiatorCustomerId === auth.customer.id;
    const isRespondent = agentDeal.respondentCustomerId === auth.customer.id;
    if (!isInitiator && !isRespondent) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Once a deal is at Gavel, further negotiation actions would create
    // conflicting state — refuse and let the dispute play out.
    if (agentDeal.dispute) {
      return NextResponse.json(
        {
          error: "This deal is under dispute and is locked from further negotiation actions.",
          disputeId: agentDeal.dispute.id,
          gavelCaseId: agentDeal.dispute.gavelCaseId,
          status: agentDeal.dispute.status,
        },
        { status: 409 }
      );
    }

    if (!agentDeal.dealRoom) {
      return NextResponse.json(
        { error: "Deal has not been negotiated yet" },
        { status: 400 }
      );
    }

    if (agentDeal.status !== "AGREED" && agentDeal.status !== "NEGOTIATING") {
      return NextResponse.json(
        { error: `Cannot counter-propose on deal with status: ${agentDeal.status}` },
        { status: 409 }
      );
    }

    // Find the party record
    const partyRole = isInitiator ? "INITIATOR" : "RESPONDENT";
    const party = agentDeal.dealRoom.parties.find((p) => p.role === partyRole);
    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    // Create a new negotiation round
    const currentRound = agentDeal.dealRoom.currentRound + 1;
    const round = await prisma.negotiationRound.create({
      data: {
        dealRoomId: agentDeal.dealRoom.id,
        roundNumber: currentRound,
        initiatedBy: partyRole as "INITIATOR" | "RESPONDENT",
      },
    });

    await prisma.dealRoom.update({
      where: { id: agentDeal.dealRoom.id },
      data: { currentRound },
    });

    // Create counter-proposals
    const created = [];
    for (const proposal of proposals) {
      const { clauseId, optionCode, rationale } = proposal;

      const clause = agentDeal.dealRoom.clauses.find((c) => c.id === clauseId);
      if (!clause) continue;

      // Look up option by code
      const option = await prisma.clauseOption.findFirst({
        where: {
          clauseTemplateId: clause.clauseTemplateId,
          code: optionCode,
        },
      });
      if (!option) continue;

      const cp = await prisma.counterProposal.create({
        data: {
          roundId: round.id,
          dealRoomClauseId: clause.id,
          partyId: party.id,
          proposedOptionId: option.id,
          rationale,
        },
      });

      created.push({
        id: cp.id,
        clauseId: clause.id,
        optionCode,
        status: cp.status,
      });
    }

    // Fire webhook to the other party
    const otherCustomerId = isInitiator
      ? agentDeal.respondentCustomerId
      : agentDeal.initiatorCustomerId;
    if (otherCustomerId) {
      fireWebhook(otherCustomerId, "negotiation.counter", {
        agentDealRoomId: agentDeal.id,
        roundNumber: currentRound,
        proposalCount: created.length,
        proposedBy: partyRole,
      }).catch(() => {});
    }

    return NextResponse.json({
      roundNumber: currentRound,
      proposals: created,
    });
    });
  } catch (error) {
    logger.error("Error creating counter-proposals", { err: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
