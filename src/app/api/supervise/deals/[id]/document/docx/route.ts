// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Supervisor Contract Document DOCX API Route
 *
 * GET /api/supervise/deals/[id]/document/docx
 * Generates and returns a Word document for supervisor review.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import {
  generateContractData,
  enrichWithCertification,
  isDealSignable,
} from "@/server/services/document/generator";
import { generateContractDocx } from "@/server/services/document/contractDocx";
import { apiError } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Decode supervisor session from JWT cookie
    const cookieStore = await cookies();
    const supervisorToken = cookieStore.get("supervisor_session")?.value;

    if (!supervisorToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let supervisorEmail: string | null = null;
    try {
      const decoded = await decode({
        token: supervisorToken,
        secret: process.env.NEXTAUTH_SECRET!,
      });
      if (decoded?.email) {
        supervisorEmail = decoded.email as string;
      }
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    if (!supervisorEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify supervisor is active
    const supervisor = await prisma.supervisor.findUnique({
      where: { email: supervisorEmail.toLowerCase() },
    });

    if (!supervisor || !supervisor.isActive) {
      return NextResponse.json(
        { error: "Supervisor access required" },
        { status: 403 }
      );
    }

    const { id: dealRoomId } = await params;

    // Verify supervisor is assigned to this deal
    const assignment = await prisma.supervisorAssignment.findUnique({
      where: {
        supervisorId_dealRoomId: {
          supervisorId: supervisor.id,
          dealRoomId,
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "You are not assigned to this deal" },
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
    return apiError(error, "Failed to generate DOCX");
  }
}
