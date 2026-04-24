/**
 * Contract Document TXT API Route
 *
 * GET /api/deals/[id]/document/txt
 * Generates and returns a plain text document of the finalized contract.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  generateContractData,
  validateDealAccess,
  isDealSignable,
  buildContractFilename,
} from "@/server/services/document/generator";
import { generateContractTxt } from "@/server/services/document/contractTxt";
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

    const txtContent = generateContractTxt(contractData);
    const buffer = Buffer.from(txtContent, "utf-8");

    const filename = buildContractFilename(contractData, "txt");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    return apiError(error, "Failed to generate TXT");
  }
}
