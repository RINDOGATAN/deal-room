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
} from "@/server/middleware/apiKeyAuth";

export async function POST(req: NextRequest) {
  try {
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
  } catch (error) {
    console.error("Error initiating negotiation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
