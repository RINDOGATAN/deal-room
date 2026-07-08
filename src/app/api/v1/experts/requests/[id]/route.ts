// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Experts Directory API — Request Status
 *
 * GET /api/v1/experts/requests/:id
 * Authenticated via API key (Bearer drk_...) with scope "experts:contact".
 *
 * Returns the status of a contact request. External apps poll this
 * to know when an expert has accepted/declined.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { features } from "@/config/features";
import { createLogger } from "@/lib/logger";

const logger = createLogger("experts-api");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!features.expertsApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    const auth = await authenticateApiKey(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requireScope(auth, "experts:contact");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const { id } = await params;

    // Only allow fetching requests that belong to this customer
    const request = await prisma.recommendationRequest.findFirst({
      where: {
        id,
        sourceCustomerId: auth.customer.id,
      },
      include: {
        lawyer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    return NextResponse.json({
      requestId: request.id,
      expertId: request.lawyerId,
      expertName: request.lawyer.name,
      subject: request.contractType,
      status: request.status,
      message: request.message,
      requesterName: request.externalRequesterName,
      requesterEmail: request.externalRequesterEmail,
      requesterCompany: request.externalRequesterCompany,
      governingLaw: request.governingLaw,
      respondedAt: request.respondedAt,
      createdAt: request.createdAt,
    });
  } catch (error) {
    logger.error("Error fetching request status", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
