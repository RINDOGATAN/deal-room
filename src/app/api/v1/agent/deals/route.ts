// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — List Agent Deals / Solo fact intake
 *
 * GET  /api/v1/agent/deals — all agent deals where the customer is a party.
 * POST /api/v1/agent/deals — create an agreed SOLO deal from a fact package
 *   (the DPO Central seam: the caller supplies its knowledge of the
 *   customer's stack as facts; Dealroom supplies the contract know-how and
 *   returns the document set).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { features } from "@/config/features";
import { createLogger } from "@/lib/logger";
import { withIdempotency } from "@/server/middleware/idempotency";
import { checkDealCreationEntitlement } from "@/server/services/licensing/entitlement";
import { createSoloDealFromFacts } from "@/server/services/agent/soloIntake";

const logger = createLogger("agent-api");

const intakeSchema = z.object({
  schema: z.literal("dealroom.solo-intake/1").optional(),
  contractType: z.string().min(1),
  governingLaw: z.string().min(1),
  language: z.string().optional(),
  dealName: z.string().min(1).max(200),
  initiatorEmail: z.string().email().optional(),
  initiatorCompany: z.string().max(200).optional(),
  fillRole: z.string().optional(),
  parameters: z.record(z.string(), z.string()).optional(),
  selections: z.record(z.string(), z.string()).optional(),
  selectionPolicy: z.enum(["explicit", "defaults"]).optional(),
});

export async function POST(req: NextRequest) {
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

    return withIdempotency(req, auth.customer.id, async () => {
      const parsed = intakeSchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid request body", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const input = parsed.data;

      const entitlement = await checkDealCreationEntitlement(
        auth.customer.id,
        input.contractType,
        input.governingLaw
      );
      if (!entitlement.entitled) {
        return NextResponse.json(
          { error: "Not entitled to use this template", reason: entitlement.reason },
          { status: 403 }
        );
      }

      const result = await createSoloDealFromFacts(prisma, auth.customer, input);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, details: result.details },
          { status: result.status }
        );
      }

      logger.info("Agent solo intake created deal", {
        customerId: auth.customer.id,
        agentDealRoomId: result.agentDealRoomId,
        status: result.status,
      });

      return NextResponse.json(
        {
          agentDealRoomId: result.agentDealRoomId,
          status: result.status,
          unresolvedClauseIds: result.unresolvedClauseIds,
          documents:
            result.status === "AGREED"
              ? {
                  pdf: `/api/v1/agent/deals/${result.agentDealRoomId}/document`,
                  docx: `/api/v1/agent/deals/${result.agentDealRoomId}/document/docx`,
                  txt: `/api/v1/agent/deals/${result.agentDealRoomId}/document/txt`,
                  tia: `/api/v1/agent/deals/${result.agentDealRoomId}/tia`,
                }
              : null,
        },
        { status: 201 }
      );
    });
  } catch (error) {
    logger.error("Agent solo intake failed", { err: String(error) });
    return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
  }
}

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
      requireScope(auth, "deals:read");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const deals = await prisma.agentDealRoom.findMany({
      where: {
        OR: [
          { initiatorCustomerId: auth.customer.id },
          { respondentCustomerId: auth.customer.id },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        dealRoomId: true,
        status: true,
        contractType: true,
        governingLaw: true,
        contractLanguage: true,
        dealName: true,
        initiatorCompany: true,
        respondentCompany: true,
        failureReason: true,
        resolvedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ deals });
  } catch (error) {
    logger.error("Error listing agent deals", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
