// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Contract Document DOCX API Route
 *
 * GET /api/deals/[id]/document/docx
 * Generates and returns a Word document of the finalized contract.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  generateContractData,
  validateDealAccess,
  isDealSignable,
  enrichWithCertification,
  buildContractFilename,
} from "@/server/services/document/generator";
import { generateContractDocx } from "@/server/services/document/contractDocx";
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

    let contractData = await generateContractData(dealRoomId);
    if (!contractData) {
      return NextResponse.json(
        { error: "Failed to generate contract data" },
        { status: 500 }
      );
    }

    contractData = await enrichWithCertification(dealRoomId, contractData);

    const docxBuffer = await generateContractDocx(contractData);
    const uint8Array = new Uint8Array(docxBuffer);

    const filename = buildContractFilename(contractData, "docx");

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
    return apiError(error, "Failed to generate DOCX");
  }
}
