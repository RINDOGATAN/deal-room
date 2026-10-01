// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — List Templates
 *
 * GET /api/v1/agent/templates[?q=nda]
 * Returns available contract templates with clauses and options,
 * filtered by the customer's entitlements. With `q`, only the templates
 * the shared contract search matches, best match first.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { checkEntitlement } from "@/server/services/licensing/entitlement";
import { features } from "@/config/features";
import { createLogger } from "@/lib/logger";
import { LIVE_ROWS } from "@/lib/clause-retirement";
import { localizedValues, searchContracts } from "@/lib/contract-search";

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
      requireScope(auth, "templates:read");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    // Get all active templates (exclude solo-mode-only, e.g. board minutes)
    const templates = await prisma.contractTemplate.findMany({
      where: { isActive: true, soloModeOnly: false },
      include: {
        skillPackage: true,
        clauses: {
          where: LIVE_ROWS,
          orderBy: { order: "asc" },
          select: {
            clauseId: true,
            title: true,
            category: true,
            order: true,
            plainDescription: true,
            isRequired: true,
          },
        },
      },
      orderBy: { contractType: "asc" },
    });

    // Filter by entitlements: include free templates + entitled ones
    const filteredTemplates = [];
    for (const t of templates) {
      if (!t.skillPackageId || !t.skillPackage) {
        // Free template
        filteredTemplates.push(t);
        continue;
      }

      const result = await checkEntitlement(
        auth.customer.id,
        t.skillPackage.skillId
      );
      if (result.entitled) {
        filteredTemplates.push(t);
      }
    }

    // Optional `?q=`: the shared contract search ("nda", "dpa",
    // "confidencialidad"), best match first.
    const matched = searchContracts(req.nextUrl.searchParams.get("q"), filteredTemplates, (t) => ({
      codes: [t.contractType],
      families: [t.templateFamily],
      names: [t.displayName, ...localizedValues(t.displayNameLocalized)],
      descriptions: [t.description, ...localizedValues(t.descriptionLocalized)],
      categories: [t.category, ...localizedValues(t.categoryLocalized)],
    }));

    return NextResponse.json({
      templates: matched.map((t) => ({
        contractType: t.contractType,
        displayName: t.displayName,
        description: t.description,
        version: t.version,
        jurisdictions: t.jurisdictions,
        languages: t.languages,
        category: t.category,
        isPremium: !!t.skillPackageId,
        clauseCount: t.clauses.length,
        clauses: t.clauses,
      })),
    });
  } catch (error) {
    logger.error("Error listing templates", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
