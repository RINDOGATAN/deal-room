// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — Subscription Status
 *
 * GET /api/v1/agent/subscriptions
 * Returns the authenticated customer's active skill entitlements.
 *
 * NOTE: This file lives at /credits/ for backward compatibility but
 * serves subscription data. The /subscriptions alias is preferred.
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

const logger = createLogger("agent-api");

export async function GET(req: NextRequest) {
  try {
    if (!features.agentApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    const auth = await authenticateApiKey(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requireScope(auth, "billing:read");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const entitlements = await prisma.skillEntitlement.findMany({
      where: { customerId: auth.customer.id },
      include: {
        skillPackage: {
          select: {
            skillId: true,
            displayName: true,
            isPremium: true,
            jurisdictions: true,
            languages: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      subscriptions: entitlements.map((e) => ({
        id: e.id,
        skillId: e.skillPackage.skillId,
        displayName: e.skillPackage.displayName,
        isPremium: e.skillPackage.isPremium,
        status: e.status,
        licenseType: e.licenseType,
        jurisdictions: e.jurisdictions,
        availableJurisdictions: e.skillPackage.jurisdictions,
        languages: e.skillPackage.languages,
        expiresAt: e.expiresAt,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    logger.error("Error getting subscriptions", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
