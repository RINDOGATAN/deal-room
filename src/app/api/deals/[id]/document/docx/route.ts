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
} from "@/server/services/document/generator";
import { generateContractDocx } from "@/server/services/document/contractDocx";

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
    console.error("Error generating contract DOCX:", error);
    return NextResponse.json(
      { error: "Failed to generate DOCX" },
      { status: 500 }
    );
  }
}
