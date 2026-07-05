/**
 * Agent API — List Agent Deals
 *
 * GET /api/v1/agent/deals
 * Returns all agent deals where the authenticated customer is a party.
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
