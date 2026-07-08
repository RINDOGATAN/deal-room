// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Experts Directory API — Available Filters
 *
 * GET /api/v1/experts/filters
 * Returns distinct specializations, countries, languages, and expert types
 * from all published expert profiles.
 *
 * Authenticated via API key (Bearer drk_...) with scope "experts:read".
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { features } from "@/config/features";
import {
  EXPERT_TYPES,
  SPECIALIZATION_LABELS,
  type Specialization,
} from "@/server/services/experts/taxonomy";
import { createLogger } from "@/lib/logger";

const logger = createLogger("experts-api");

export async function GET(req: NextRequest) {
  try {
    if (!features.expertsApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    const auth = await authenticateApiKey(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requireScope(auth, "experts:read");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const profiles = await prisma.lawyerProfile.findMany({
      // The expertTypes guard keeps legacy LEGAL-only rows unexposed.
      where: {
        isPublished: true,
        expertTypes: { hasSome: [...EXPERT_TYPES] },
      },
      select: {
        specializations: true,
        countryCode: true,
        languages: true,
        expertTypes: true,
      },
    });

    // Collect distinct values
    const specSet = new Set<string>();
    const countrySet = new Set<string>();
    const langSet = new Set<string>();
    const typeSet = new Set<string>();

    for (const p of profiles) {
      for (const s of p.specializations) {
        specSet.add(SPECIALIZATION_LABELS[s as Specialization] ?? s);
      }
      if (p.countryCode) countrySet.add(p.countryCode);
      for (const l of p.languages) langSet.add(l);
      for (const t of p.expertTypes) {
        // Skip residual legacy types (e.g. "LEGAL") on mixed-type rows.
        if ((EXPERT_TYPES as readonly string[]).includes(t)) {
          typeSet.add(t.toLowerCase());
        }
      }
    }

    return NextResponse.json({
      specializations: [...specSet].sort(),
      countries: [...countrySet].sort(),
      languages: [...langSet].sort(),
      expertTypes: [...typeSet].sort(),
    });
  } catch (error) {
    logger.error("Error fetching expert filters", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
