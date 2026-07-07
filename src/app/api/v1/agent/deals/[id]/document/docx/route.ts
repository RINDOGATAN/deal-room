// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — Download DOCX
 *
 * GET /api/v1/agent/deals/:id/document/docx
 * Downloads the agreed contract as a Word document.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { generateContractData, enrichWithCertification } from "@/server/services/document/generator";
import { generateContractDocx } from "@/server/services/document/contractDocx";
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
    });

    if (!agentDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Verify access
    if (
      agentDeal.initiatorCustomerId !== auth.customer.id &&
      agentDeal.respondentCustomerId !== auth.customer.id
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (agentDeal.status !== "AGREED" || !agentDeal.dealRoomId) {
      return NextResponse.json(
        { error: "Deal is not in agreed state" },
        { status: 400 }
      );
    }

    let contractData = await generateContractData(agentDeal.dealRoomId);
    if (!contractData) {
      return NextResponse.json(
        { error: "Failed to generate contract data" },
        { status: 500 }
      );
    }

    contractData = await enrichWithCertification(agentDeal.dealRoomId, contractData);

    const docxBuffer = await generateContractDocx(contractData);
    const uint8Array = new Uint8Array(docxBuffer);

    const sanitizedName = contractData.dealName
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    const filename = `${sanitizedName}_contract.docx`;

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": docxBuffer.length.toString(),
      },
    });
  } catch (error) {
    logger.error("Error generating agent deal DOCX", { err: String(error) });
    return NextResponse.json(
      { error: "Failed to generate DOCX" },
      { status: 500 }
    );
  }
}
