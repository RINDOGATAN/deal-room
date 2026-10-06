// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The agent download of an agreed contract in a text format (Markdown or
 * HTML): the same key, scope, access and payment checks as the PDF, DOCX
 * and TXT routes, then one of the renderers over the same ContractData.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApiKey, requireScope, ApiScopeError } from "@/server/middleware/apiKeyAuth";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";
import { agentPaymentRequiredResponse, dealAccessForAgent } from "@/server/services/billing/deal-entitlement";
import { generateContractData } from "@/server/services/document/generator";
import { generateContractMarkdown } from "@/server/services/document/contractMarkdown";
import { generateContractHtml } from "@/server/services/document/contractHtml";

export type TextFormat = "md" | "html";

export const TEXT_FORMATS: Record<TextFormat, { contentType: string; ext: string; render: typeof generateContractMarkdown }> = {
  md: { contentType: "text/markdown; charset=utf-8", ext: "md", render: generateContractMarkdown },
  html: { contentType: "text/html; charset=utf-8", ext: "html", render: generateContractHtml },
};

export async function agentTextDocument(req: NextRequest, id: string, format: TextFormat): Promise<NextResponse> {
  try {
    if (!features.agentApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }
    const auth = await authenticateApiKey(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      requireScope(auth, "deals:read");
    } catch (e) {
      if (e instanceof ApiScopeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    const agentDeal = await prisma.agentDealRoom.findUnique({ where: { id } });
    if (!agentDeal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    if (agentDeal.initiatorCustomerId !== auth.customer.id && agentDeal.respondentCustomerId !== auth.customer.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (agentDeal.status !== "AGREED" || !agentDeal.dealRoomId) {
      return NextResponse.json({ error: "Deal is not in agreed state" }, { status: 400 });
    }

    // Pay per contract, exactly as the PDF, DOCX and TXT downloads.
    const access = await dealAccessForAgent(agentDeal.dealRoomId, {
      apiKeyId: auth.apiKey.id,
      customerId: auth.customer.id,
    });
    if (!access.paid) return agentPaymentRequiredResponse();

    const data = await generateContractData(agentDeal.dealRoomId);
    if (!data) return NextResponse.json({ error: "Failed to generate contract data" }, { status: 500 });

    const spec = TEXT_FORMATS[format];
    const buffer = Buffer.from(spec.render(data), "utf-8");
    const name = data.dealName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": spec.contentType,
        "Content-Disposition": `inline; filename="${name}_contract.${spec.ext}"`,
        "Content-Length": buffer.length.toString(),
        // A contract is private: never cached by a shared cache.
        "Cache-Control": "private, no-store",
        ...(format === "html" ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } : {}),
      },
    });
  } catch (error) {
    return apiError(error, `Failed to generate the ${format === "md" ? "Markdown" : "HTML"} document`);
  }
}
