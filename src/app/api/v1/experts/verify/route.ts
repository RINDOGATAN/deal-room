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
  SPECIALIZATION_LABELS,
  type Specialization,
} from "@/server/services/experts/taxonomy";

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

    // Verified if the user exists, has a LawyerProfile, and the profile
    // has at least a title or one specialization.
    const profile = user?.lawyerProfile;
    const isVerified =
      !!profile &&
      (!!profile.title || profile.specializations.length > 0);

    if (!isVerified) {
      return NextResponse.json({ verified: false });
    }

    return NextResponse.json({
      verified: true,
      expert: {
        id: user!.id,
        name: user!.name,
        expertTypes: profile!.expertTypes.map((t: string) => t.toLowerCase()),
        specializations: profile!.specializations.map(
          (s) => SPECIALIZATION_LABELS[s as Specialization] ?? s
        ),
      },
    });
  } catch (error) {
    console.error("Error verifying expert:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
