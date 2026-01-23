/**
 * Contract Document PDF API Route
 *
 * GET /api/deals/[id]/document
 * Generates and returns a PDF of the finalized contract.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  generateContractData,
  validateDealAccess,
  isDealSignable,
} from "@/server/services/document/generator";
import { ContractPDF } from "@/server/services/document/ContractPDF";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: dealRoomId } = await params;

    // Validate user is party to the deal
    const hasAccess = await validateDealAccess(dealRoomId, session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "You are not a party to this deal" },
        { status: 403 }
      );
    }

    // Check deal is in signable state
    const signable = await isDealSignable(dealRoomId);
    if (!signable) {
      return NextResponse.json(
        { error: "Deal is not ready for document generation" },
        { status: 400 }
      );
    }

    // Generate contract data
    const contractData = await generateContractData(dealRoomId);
    if (!contractData) {
      return NextResponse.json(
        { error: "Failed to generate contract data" },
        { status: 500 }
      );
    }

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      ContractPDF({ data: contractData })
    );

    // Create filename
    const sanitizedName = contractData.dealName
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    const filename = `${sanitizedName}_contract.pdf`;

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(pdfBuffer);

    // Return PDF as downloadable file
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating contract PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
