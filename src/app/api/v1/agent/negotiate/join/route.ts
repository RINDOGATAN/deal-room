// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — Join Negotiation
 *
 * POST /api/v1/agent/negotiate/join
 * Respondent joins with a negotiation token + their playbook.
 * Triggers the full negotiation pipeline and returns the result.
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
import { runNegotiation } from "@/server/services/agent/negotiator";
import { features } from "@/config/features";
import { createLogger } from "@/lib/logger";

const logger = createLogger("agent-api");

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

    // Rate limit check
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
    const body = await req.json();
    const {
      negotiationToken,
      playbookId,
      respondentCompany,
      respondentEmail,
    } = body;

    if (!negotiationToken || !playbookId || !respondentEmail) {
      return NextResponse.json(
        {
          error:
            "negotiationToken, playbookId, and respondentEmail are required",
        },
        { status: 400 }
      );
    }

    // Find the pending agent deal room
    const agentDealRoom = await prisma.agentDealRoom.findUnique({
      where: { negotiationToken },
    });

    if (!agentDealRoom) {
      return NextResponse.json(
        { error: "Invalid negotiation token" },
        { status: 404 }
      );
    }

    if (agentDealRoom.status !== "PENDING_RESPONDENT") {
      return NextResponse.json(
        {
          error: `Negotiation is no longer pending. Current status: ${agentDealRoom.status}`,
        },
        { status: 409 }
      );
    }

    // Prevent self-negotiation
    if (agentDealRoom.initiatorCustomerId === auth.customer.id) {
      return NextResponse.json(
        { error: "Cannot join your own negotiation" },
        { status: 400 }
      );
    }

    // Validate the respondent's playbook
    const playbook = await prisma.playbook.findUnique({
      where: { id: playbookId },
      include: { entries: true },
    });

    if (!playbook || playbook.customerId !== auth.customer.id) {
      return NextResponse.json(
        { error: "Playbook not found" },
        { status: 404 }
      );
    }

    if (!playbook.isActive || playbook.entries.length === 0) {
      return NextResponse.json(
        { error: "Playbook is not active or has no entries" },
        { status: 400 }
      );
    }

    // Playbook must be for the same contract type
    if (playbook.contractType !== agentDealRoom.contractType) {
      return NextResponse.json(
        {
          error: `Playbook contract type "${playbook.contractType}" does not match deal "${agentDealRoom.contractType}"`,
        },
        { status: 400 }
      );
    }

    // Update the agent deal room with respondent info
    const updatedDeal = await prisma.agentDealRoom.update({
      where: { id: agentDealRoom.id },
      data: {
        respondentCustomerId: auth.customer.id,
        respondentPlaybookId: playbookId,
        respondentCompany: respondentCompany || auth.customer.name,
        respondentEmail,
        status: "NEGOTIATING",
      },
      include: {
        initiatorPlaybook: { include: { entries: true } },
        respondentPlaybook: { include: { entries: true } },
      },
    });

    // Run the negotiation
    const result = await runNegotiation(updatedDeal);

    return NextResponse.json(result);
    });
  } catch (error) {
    logger.error("Error joining negotiation", { err: String(error) });

    // If negotiation fails mid-process, try to mark as failed
    // (the negotiator itself handles most failure cases)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
