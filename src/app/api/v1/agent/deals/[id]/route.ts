// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — Deal Detail
 *
 * GET /api/v1/agent/deals/:id
 * Returns deal outcome with agreed clauses and satisfaction scores.
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
      include: {
        dealRoom: {
          include: {
            clauses: {
              include: {
                clauseTemplate: true,
                compromiseSuggestions: {
                  orderBy: { roundNumber: "desc" },
                  take: 1,
                },
              },
              orderBy: { clauseTemplate: { order: "asc" } },
            },
          },
        },
      },
    });

    if (!agentDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Verify the customer is a party
    if (
      agentDeal.initiatorCustomerId !== auth.customer.id &&
      agentDeal.respondentCustomerId !== auth.customer.id
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Build response
    const response: Record<string, unknown> = {
      id: agentDeal.id,
      dealRoomId: agentDeal.dealRoomId,
      status: agentDeal.status,
      contractType: agentDeal.contractType,
      governingLaw: agentDeal.governingLaw,
      contractLanguage: agentDeal.contractLanguage,
      dealName: agentDeal.dealName,
      initiatorCompany: agentDeal.initiatorCompany,
      respondentCompany: agentDeal.respondentCompany,
      failureReason: agentDeal.failureReason,
      resolvedAt: agentDeal.resolvedAt,
      createdAt: agentDeal.createdAt,
      // Attorney attestation
      attorneyAttestation: agentDeal.attestingBarNumber
        ? {
            attorneyName: agentDeal.attestingAttorneyName,
            barNumber: agentDeal.attestingBarNumber,
            statement: `The legal provisions in this contract have been reviewed and attested by ${agentDeal.attestingAttorneyName} (Bar No. ${agentDeal.attestingBarNumber}) pursuant to UETA § 14 and the federal E-SIGN Act.`,
          }
        : null,
    };

    // Include clause details if deal was resolved
    if (agentDeal.dealRoom) {
      response.clauses = agentDeal.dealRoom.clauses.map((c) => {
        const suggestion = c.compromiseSuggestions[0];
        return {
          clauseId: c.clauseTemplate.clauseId,
          title: c.clauseTemplate.title,
          category: c.clauseTemplate.category,
          status: c.status,
          agreedOptionId: c.agreedOptionId,
          satisfaction: suggestion
            ? {
                initiator: suggestion.satisfactionPartyA,
                respondent: suggestion.satisfactionPartyB,
                reasoning: suggestion.reasoning,
              }
            : null,
        };
      });

      // Calculate overall satisfaction
      const suggestions = agentDeal.dealRoom.clauses
        .map((c) => c.compromiseSuggestions[0])
        .filter(Boolean);

      if (suggestions.length > 0) {
        response.overallSatisfaction = {
          initiator:
            Math.round(
              suggestions.reduce((s, c) => s + c!.satisfactionPartyA, 0) /
                suggestions.length
            ),
          respondent:
            Math.round(
              suggestions.reduce((s, c) => s + c!.satisfactionPartyB, 0) /
                suggestions.length
            ),
        };
      }
    }

    // Include negotiation log if failed
    if (agentDeal.status === "FAILED" && agentDeal.negotiationLog) {
      response.negotiationLog = agentDeal.negotiationLog;
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Error getting deal detail", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
