// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — Download standalone Transfer Impact Assessment
 *
 * GET /api/v1/agent/deals/:id/tia
 * Produces the DPA's Annex IV as its own PDF, on demand (SCC Clause 14).
 * Supports ?whitelabel=1 like the interactive route. 404s cleanly when the
 * deal carries no TIA annex.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { generateContractData } from "@/server/services/document/generator";
import { TiaPDF } from "@/server/services/document/ContractPDF";
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

    const agentDeal = await prisma.agentDealRoom.findUnique({ where: { id } });
    if (!agentDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
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

    const contractData = await generateContractData(agentDeal.dealRoomId);
    if (!contractData) {
      return NextResponse.json(
        { error: "Failed to generate contract data" },
        { status: 500 }
      );
    }

    const hasTia = contractData.boilerplate?.annexes?.some((a) =>
      /^(Annex IV|Anexo IV)/.test(a.title)
    );
    if (!hasTia) {
      return NextResponse.json(
        { error: "This deal has no Transfer Impact Assessment annex" },
        { status: 404 }
      );
    }

    const lang = contractData.language === "es" ? "es" : "en";
    const producedOn = new Date().toLocaleDateString(
      lang === "es" ? "es-ES" : "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    );
    const whiteLabel = req.nextUrl.searchParams.get("whitelabel") === "1";

    const pdfBuffer = await renderToBuffer(
      TiaPDF({ data: contractData, producedOn, whiteLabel })
    );

    const sanitizedName = contractData.dealName
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    const filename = `${sanitizedName}_tia.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    logger.error("Error generating agent deal TIA", { err: String(error) });
    return NextResponse.json(
      { error: "Failed to generate the Transfer Impact Assessment PDF" },
      { status: 500 }
    );
  }
}
