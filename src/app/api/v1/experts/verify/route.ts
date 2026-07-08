// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Experts Directory API — Verify by Email
 *
 * GET /api/v1/experts/verify?email=john@example.com
 * Authenticated via API key (Bearer drk_...) with scope "experts:read".
 *
 * Returns whether the email belongs to a registered expert with a
 * sufficiently complete profile (has title or specializations).
 * Used by Clausemaster to auto-grant publisher access.
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

    const email = req.nextUrl.searchParams.get("email");
    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        name: true,
        lawyerProfile: {
          select: {
            title: true,
            expertTypes: true,
            specializations: true,
            acceptingClients: true,
          },
        },
      },
    });

    // Verified if the user exists, has a LawyerProfile with at least one
    // allowed expert type (legacy LEGAL-only rows are never verified), and
    // the profile has at least a title or one specialization.
    const profile = user?.lawyerProfile;
    const isVerified =
      !!profile &&
      profile.expertTypes.some((t: string) =>
        (EXPERT_TYPES as readonly string[]).includes(t)
      ) &&
      (!!profile.title || profile.specializations.length > 0);

    if (!isVerified) {
      return NextResponse.json({ verified: false });
    }

    return NextResponse.json({
      verified: true,
      expert: {
        id: user!.id,
        name: user!.name,
        // Drop any residual legacy types (e.g. "LEGAL") from mixed-type rows.
        expertTypes: profile!.expertTypes
          .filter((t: string) => (EXPERT_TYPES as readonly string[]).includes(t))
          .map((t: string) => t.toLowerCase()),
        specializations: profile!.specializations.map(
          (s) => SPECIALIZATION_LABELS[s as Specialization] ?? s
        ),
      },
    });
  } catch (error) {
    logger.error("Error verifying expert", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
