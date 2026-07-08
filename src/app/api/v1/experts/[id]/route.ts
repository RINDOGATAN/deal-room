// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Experts Directory API — Get by ID
 *
 * GET /api/v1/experts/:id
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
  CERTIFICATION_LABELS,
  computeProfileCompleteness,
  type Specialization,
  type Certification,
} from "@/server/services/experts/taxonomy";
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
      requireScope(auth, "experts:read");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const { id } = await params;

    const profile = await prisma.lawyerProfile.findFirst({
      // The expertTypes guard keeps legacy LEGAL-only rows unexposed.
      where: {
        userId: id,
        isPublished: true,
        expertTypes: { hasSome: [...EXPERT_TYPES] },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            image: true,
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Expert not found" }, { status: 404 });
    }

    const result = {
      id: profile.user.id,
      name: profile.user.name,
      email: profile.user.email,
      title: profile.title,
      firm: profile.user.company,
      bio: profile.bio,
      // Drop any residual legacy types (e.g. "LEGAL") from mixed-type rows.
      expertTypes: profile.expertTypes
        .filter((t: string) => (EXPERT_TYPES as readonly string[]).includes(t))
        .map((t: string) => t.toLowerCase()),
      specializations: profile.specializations.map(
        (s) => SPECIALIZATION_LABELS[s as Specialization] ?? s
      ),
      certifications: profile.certifications.map(
        (c) => CERTIFICATION_LABELS[c as Certification] ?? c
      ),
      languages: profile.languages,
      location: {
        city: profile.city,
        country: profile.countryCode,
      },
      jurisdictions: profile.jurisdictionsCovered,
      contactUrl: profile.contactUrl,
      imageUrl: profile.user.image,
      acceptingClients: profile.acceptingClients,
      profileCompleteness: computeProfileCompleteness(profile),
    };

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Error fetching expert", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
