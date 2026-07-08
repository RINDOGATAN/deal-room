// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — Dispute Escalation
 *
 * POST /api/v1/agent/deals/:id/dispute
 * Escalate a deal to Gavel ADR when negotiation fails or breach alleged.
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
import { createLogger } from "@/lib/logger";

const logger = createLogger("agent-api");

const GAVEL_API_URL = process.env.GAVEL_API_URL || "https://gavel.todo.law/api/v1";
const GAVEL_API_KEY = process.env.GAVEL_API_KEY;

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
      requireScope(auth, "disputes:create");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    return await withIdempotency(req, auth.customer.id, async () => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason, escrowAmount } = body as {
      reason?: string;
      escrowAmount?: number;
    };

    const agentDeal = await prisma.agentDealRoom.findUnique({
      where: { id },
      include: { dispute: true },
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

    // Check if dispute already exists
    if (agentDeal.dispute) {
      return NextResponse.json(
        {
          error: "Dispute already exists for this deal",
          disputeId: agentDeal.dispute.id,
          gavelCaseId: agentDeal.dispute.gavelCaseId,
          status: agentDeal.dispute.status,
        },
        { status: 409 }
      );
    }

    // Only FAILED or AGREED deals can be disputed
    if (agentDeal.status !== "FAILED" && agentDeal.status !== "AGREED") {
      return NextResponse.json(
        {
          error: `Cannot dispute a deal with status: ${agentDeal.status}. Only FAILED or AGREED deals can be disputed.`,
        },
        { status: 400 }
      );
    }

    // Create Gavel case
    let gavelCaseId: string;
    let gavelCaseUrl: string | undefined;

    if (GAVEL_API_KEY) {
      try {
        const gavelRes = await fetch(`${GAVEL_API_URL}/cases`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GAVEL_API_KEY}`,
          },
          body: JSON.stringify({
            type: "contract_dispute",
            parties: [
              {
                role: "claimant",
                company: isInitiator
                  ? agentDeal.initiatorCompany
                  : agentDeal.respondentCompany,
                email: isInitiator
                  ? agentDeal.initiatorEmail
                  : agentDeal.respondentEmail,
              },
              {
                role: "respondent",
                company: isInitiator
                  ? agentDeal.respondentCompany
                  : agentDeal.initiatorCompany,
                email: isInitiator
                  ? agentDeal.respondentEmail
                  : agentDeal.initiatorEmail,
              },
            ],
            contractType: agentDeal.contractType,
            governingLaw: agentDeal.governingLaw,
            reason: reason || "Dispute escalated from Dealroom",
            escrowAmount: escrowAmount || undefined,
            metadata: {
              agentDealRoomId: agentDeal.id,
              dealRoomId: agentDeal.dealRoomId,
            },
          }),
        });

        if (!gavelRes.ok) {
          const errBody = await gavelRes.text();
          logger.error("Gavel API error", { err: String(errBody) });
          return NextResponse.json(
            { error: "Failed to create Gavel case" },
            { status: 502 }
          );
        }

        const gavelData = (await gavelRes.json()) as {
          id: string;
          url?: string;
        };
        gavelCaseId = gavelData.id;
        gavelCaseUrl = gavelData.url;
      } catch (err) {
        logger.error("Gavel API connection error", { err: String(err) });
        return NextResponse.json(
          { error: "Gavel service unavailable" },
          { status: 503 }
        );
      }
    } else {
      // Gavel not configured — create a placeholder dispute
      gavelCaseId = `placeholder_${Date.now()}`;
      gavelCaseUrl = undefined;
    }

    // Create AgentDispute record
    const dispute = await prisma.agentDispute.create({
      data: {
        agentDealRoomId: agentDeal.id,
        gavelCaseId,
        escrowAmount: escrowAmount || null,
        status: "PENDING",
      },
    });

    return NextResponse.json(
      {
        disputeId: dispute.id,
        gavelCaseId: dispute.gavelCaseId,
        gavelCaseUrl,
        status: dispute.status,
        createdAt: dispute.createdAt,
      },
      { status: 201 }
    );
    });
  } catch (error) {
    logger.error("Error creating dispute", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
