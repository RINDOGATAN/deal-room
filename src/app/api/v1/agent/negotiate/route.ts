// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — Initiate Negotiation
 *
 * POST /api/v1/agent/negotiate
 * Creates a pending agent deal room and returns a negotiation token
 * for the respondent to join.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
  checkRateLimit,
  checkA2aRateLimit,
} from "@/server/middleware/apiKeyAuth";
import { withIdempotency } from "@/server/middleware/idempotency";
import { checkDealCreationEntitlement } from "@/server/services/licensing/entitlement";
import { features } from "@/config/features";
import { fireWebhook } from "@/server/services/agent/webhooks";
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

    return await withIdempotency(req, auth.customer.id, async () => {
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

    const body = await req.json();
    const {
      playbookId,
      dealName,
      initiatorCompany,
      initiatorEmail,
      respondentCompany,
      respondentEmail,
    } = body;

    // Validate required fields
    if (!playbookId || !dealName || !initiatorEmail) {
      return NextResponse.json(
        {
          error:
            "playbookId, dealName, and initiatorEmail are required",
        },
        { status: 400 }
      );
    }

    // Validate the playbook exists and belongs to this customer
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

    if (!playbook.isActive) {
      return NextResponse.json(
        { error: "Playbook is not active" },
        { status: 400 }
      );
    }

    if (playbook.entries.length === 0) {
      return NextResponse.json(
        { error: "Playbook has no entries" },
        { status: 400 }
      );
    }

    // Verify the contract template exists
    const template = await prisma.contractTemplate.findUnique({
      where: { contractType: playbook.contractType },
    });

    if (!template || !template.isActive) {
      return NextResponse.json(
        { error: `Contract template not found: ${playbook.contractType}` },
        { status: 400 }
      );
    }

    if (template.soloModeOnly) {
      return NextResponse.json(
        { error: "This contract type is solo-mode only and cannot be negotiated between parties" },
        { status: 400 }
      );
    }

    // Check entitlement for premium templates
    const entitlementCheck = await checkDealCreationEntitlement(
      auth.customer.id,
      playbook.contractType,
      playbook.governingLaw
    );

    if (!entitlementCheck.entitled) {
      return NextResponse.json(
        {
          error: "Not entitled to use this template",
          reason: entitlementCheck.reason,
        },
        { status: 403 }
      );
    }

    // A2A rate limit check for contract types with A2A_ prefix
    if (playbook.contractType.startsWith("A2A_")) {
      const isPremiumA2a = !!((auth.customer as Record<string, unknown>).metadata as Record<string, unknown> | null)?.premiumA2A;
      const a2aLimit = await checkA2aRateLimit(
        auth.customer.id,
        playbook.contractType,
        isPremiumA2a,
      );
      if (!a2aLimit.allowed) {
        return NextResponse.json(
          {
            error: isPremiumA2a
              ? "A2A premium weekly limit reached (300 invocations/week)."
              : "A2A contract invocation limit reached (5 per skill/week). Upgrade to premium tier for 300 calls/week.",
            remaining: a2aLimit.remaining,
          },
          {
            status: 429,
            headers: { "Retry-After": String(a2aLimit.retryAfter) },
          }
        );
      }
    }

    // Generate a unique negotiation token
    const negotiationToken = `nt_${randomBytes(24).toString("hex")}`;

    // Create the agent deal room
    const agentDealRoom = await prisma.agentDealRoom.create({
      data: {
        negotiationToken,
        initiatorCustomerId: auth.customer.id,
        initiatorPlaybookId: playbookId,
        contractType: playbook.contractType,
        governingLaw: playbook.governingLaw,
        contractLanguage: playbook.contractLanguage,
        dealName,
        initiatorCompany: initiatorCompany || auth.customer.name,
        initiatorEmail,
        respondentCompany,
        respondentEmail,
        status: "PENDING_RESPONDENT",
      },
    });

    // Fire webhook (fire-and-forget)
    fireWebhook(auth.customer.id, "negotiation.pending", {
      agentDealRoomId: agentDealRoom.id,
      negotiationToken: agentDealRoom.negotiationToken,
      contractType: agentDealRoom.contractType,
      dealName: agentDealRoom.dealName,
    }).catch(() => {});

    return NextResponse.json(
      {
        agentDealRoomId: agentDealRoom.id,
        negotiationToken: agentDealRoom.negotiationToken,
        status: agentDealRoom.status,
        contractType: agentDealRoom.contractType,
        governingLaw: agentDealRoom.governingLaw,
        dealName: agentDealRoom.dealName,
        createdAt: agentDealRoom.createdAt,
      },
      { status: 201 }
    );
    });
  } catch (error) {
    logger.error("Error initiating negotiation", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
