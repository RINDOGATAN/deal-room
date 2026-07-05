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
  EXPERT_TYPES,
  SPECIALIZATION_LABELS,
  CERTIFICATION_LABELS,
  computeProfileCompleteness,
  type Specialization,
  type Certification,
} from "@/server/services/experts/taxonomy";
import { createLogger } from "@/lib/logger";

const logger = createLogger("experts-api");

function formatProfile(profile: {
  id: string;
  bio: string | null;
  title: string | null;
  expertTypes: string[];
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
    // Drop any residual legacy types (e.g. "LEGAL") from mixed-type rows.
    expertTypes: profile.expertTypes
      .filter((t) => (EXPERT_TYPES as readonly string[]).includes(t))
      .map((t) => t.toLowerCase()),
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

    // Build Prisma where clause. The expertTypes guard is global: rows that
    // carry none of the allowed types (e.g. legacy LEGAL-only profiles) can
    // never be exposed, regardless of what the client requests.
    const where: Record<string, unknown> = {
      isPublished: true,
      expertTypes: { hasSome: [...EXPERT_TYPES] },
    };

    if (specialization) {
      // Accept both enum keys (SELF_HOSTING_DEPLOYMENT) and display labels (Self-Hosting / Deployment)
      const key =
        Object.entries(SPECIALIZATION_LABELS).find(
          ([, label]) => label.toLowerCase() === specialization.toLowerCase()
        )?.[0] ?? specialization;
      where.specializations = { has: key };
    }
    if (country) {
      where.countryCode = country;
    }
    if (language) {
      where.languages = { has: language };
    }
    if (expertType) {
      const mapped = expertType.toUpperCase();
      // Only allow-listed types can narrow the filter; anything else (incl.
      // the retired "LEGAL") leaves the global hasSome guard in place.
      if ((EXPERT_TYPES as readonly string[]).includes(mapped)) {
        where.expertTypes = { has: mapped };
      }
    }

    // Free-text search on name, company, bio, and specialization labels
    if (query && query.trim().length > 0) {
      const q = query.trim();
      const qLower = q.toLowerCase();

      // Find specialization keys whose display labels match the query
      const matchingSpecKeys = Object.entries(SPECIALIZATION_LABELS)
        .filter(([, label]) => label.toLowerCase().includes(qLower))
        .map(([key]) => key);

      const orClauses: Record<string, unknown>[] = [
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { company: { contains: q, mode: "insensitive" } } },
        { bio: { contains: q, mode: "insensitive" } },
      ];

      if (matchingSpecKeys.length > 0) {
        orClauses.push({ specializations: { hasSome: matchingSpecKeys } });
      }

      where.OR = orClauses;
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
    logger.error("Error searching experts", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
