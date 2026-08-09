// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Standalone Transfer Impact Assessment
 *
 * GET /api/deals/[id]/tia
 *
 * Produces the DPA's Annex IV as its own PDF, on demand. Clause 14 of the
 * SCCs requires the assessment to be made available to the competent
 * supervisory authority on request — this route lets a party produce it
 * without disclosing the entire signed contract. 404s cleanly when the
 * deal carries no TIA annex (EEA processor, or TIA declined).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  generateContractData,
  validateDealAccess,
  isDealSignable,
  buildContractFilename,
} from "@/server/services/document/generator";
import { TiaPDF } from "@/server/services/document/ContractPDF";
import { apiError } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: dealRoomId } = await params;

    const hasAccess = await validateDealAccess(dealRoomId, session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "You are not a party to this deal" },
        { status: 403 }
      );
    }

    const signable = await isDealSignable(dealRoomId);
    if (!signable) {
      return NextResponse.json(
        { error: "Deal is not ready for document generation" },
        { status: 400 }
      );
    }

    const contractData = await generateContractData(dealRoomId);
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

    const whiteLabel = request.nextUrl.searchParams.get("whitelabel") === "1";
    const pdfBuffer = await renderToBuffer(
      TiaPDF({ data: contractData, producedOn, whiteLabel })
    );

    // Same slug rules as the contract download, TIA-prefixed
    const filename = buildContractFilename(contractData, "pdf").replace(
      /^Dealroom-/,
      "Dealroom-TIA-"
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    return apiError(error, "Failed to generate the Transfer Impact Assessment PDF");
  }
}
