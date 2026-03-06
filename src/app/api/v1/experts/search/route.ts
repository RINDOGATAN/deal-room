/**
 * Experts Directory API — Search
 *
 * POST /api/v1/experts/search
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
  SPECIALIZATION_LABELS,
  CERTIFICATION_LABELS,
  computeProfileCompleteness,
  type Specialization,
  type Certification,
} from "@/server/services/experts/taxonomy";

function formatProfile(profile: {
  id: string;
  bio: string | null;
  title: string | null;
  expertType: string;
  specializations: string[];
  certifications: string[];
  languages: string[];
  countryCode: string | null;
  city: string | null;
  jurisdictionsCovered: string[];
  contactUrl: string | null;
  acceptingClients: boolean;
  user: {
    id: string;
    name: string | null;
    email: string;
    company: string | null;
    image: string | null;
  };
}) {
  return {
    id: profile.user.id,
    name: profile.user.name,
    email: profile.user.email,
    title: profile.title,
    firm: profile.user.company,
    bio: profile.bio,
    expertType: profile.expertType.toLowerCase(),
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
}

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const {
      query,
      specialization,
      country,
      language,
      expertType,
      limit: rawLimit,
      offset: rawOffset,
    } = body as {
      query?: string;
      specialization?: string;
      country?: string;
      language?: string;
      expertType?: string;
      limit?: number;
      offset?: number;
    };

    const limit = Math.min(Math.max(rawLimit ?? 20, 1), 100);
    const offset = Math.max(rawOffset ?? 0, 0);

    // Build Prisma where clause
    const where: Record<string, unknown> = { isPublished: true };

    if (specialization) {
      where.specializations = { has: specialization };
    }
    if (country) {
      where.countryCode = country;
    }
    if (language) {
      where.languages = { has: language };
    }
    if (expertType) {
      const mapped = expertType.toUpperCase();
      if (mapped === "LEGAL" || mapped === "TECHNICAL" || mapped === "BOTH") {
        where.expertType = mapped;
      }
    }

    // Free-text search on name, company, or bio
    if (query && query.trim().length > 0) {
      const q = query.trim();
      where.OR = [
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { company: { contains: q, mode: "insensitive" } } },
        { bio: { contains: q, mode: "insensitive" } },
      ];
    }

    const [profiles, total] = await Promise.all([
      prisma.lawyerProfile.findMany({
        where,
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
        orderBy: { createdAt: "asc" },
        skip: offset,
        take: limit,
      }),
      prisma.lawyerProfile.count({ where }),
    ]);

    const results = profiles.map(formatProfile);

    // Sort by profile completeness descending (most complete first)
    results.sort((a, b) => b.profileCompleteness - a.profileCompleteness);

    return NextResponse.json({ results, total, offset });
  } catch (error) {
    console.error("Error searching experts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
