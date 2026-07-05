/**
 * Experts Directory API — Contact Request
 *
 * POST /api/v1/experts/:id/contact
 * Authenticated via API key (Bearer drk_...) with scope "experts:contact".
 *
 * Creates a contact request from an external app (DPO Central, AI Sentinel, etc.)
 * and notifies the expert via email.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
  checkExpertContactRateLimit,
} from "@/server/middleware/apiKeyAuth";
import { features } from "@/config/features";
import { sendRecommendationRequestEmail } from "@/lib/email";
import { createLogger } from "@/lib/logger";

const logger = createLogger("experts-api");

export async function POST(
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

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const {
      requesterName,
      requesterEmail,
      requesterCompany,
      subject,
      message,
      governingLaw,
    } = body as {
      requesterName?: string;
      requesterEmail?: string;
      requesterCompany?: string;
      subject?: string;
      message?: string;
      governingLaw?: string;
    };

    // Validate required fields
    if (!requesterName || !requesterEmail || !subject) {
      return NextResponse.json(
        { error: "requesterName, requesterEmail, and subject are required" },
        { status: 400 }
      );
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) {
      return NextResponse.json({ error: "Invalid requesterEmail" }, { status: 400 });
    }

    // Validate governingLaw if provided
    const validGoverningLaws = ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"];
    if (governingLaw && !validGoverningLaws.includes(governingLaw)) {
      return NextResponse.json(
        { error: `governingLaw must be one of: ${validGoverningLaws.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify expert exists and is published
    const profile = await prisma.lawyerProfile.findFirst({
      // Belt-and-braces (2026-07-04): same guard as search/[id] — LEGAL-only profiles unreachable
      where: { userId: id, isPublished: true, expertTypes: { hasSome: ["TECHNICAL", "DEPLOYMENT"] } },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Expert not found" }, { status: 404 });
    }

    // Per-(customer, expert) daily cap. Refuse before doing any work
    // (no DB write, no email) once exhausted so a sustained spam attempt
    // costs the attacker rate-limit lookups only.
    const rateLimit = await checkExpertContactRateLimit(auth.customer.id, id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Daily contact limit for this expert reached (2/day per customer).",
          remaining: 0,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfter) },
        }
      );
    }

    // Check for duplicate pending requests from same email + subject
    const existing = await prisma.recommendationRequest.findFirst({
      where: {
        lawyerId: id,
        externalRequesterEmail: requesterEmail,
        contractType: subject,
        status: "PENDING",
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A pending request with this subject already exists", requestId: existing.id },
        { status: 409 }
      );
    }

    // Create the contact request
    const request = await prisma.recommendationRequest.create({
      data: {
        lawyerId: id,
        contractType: subject,
        governingLaw: (governingLaw as "CALIFORNIA" | "ENGLAND_WALES" | "SPAIN") ?? null,
        message: message ?? null,
        sourceApp: auth.customer.name,
        sourceCustomerId: auth.customer.id,
        externalRequesterName: requesterName,
        externalRequesterEmail: requesterEmail,
        externalRequesterCompany: requesterCompany ?? null,
        // 30-day expiry for assistance requests.
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Send email notification to the expert. notifyEmails BCCs any
    // additional inboxes the directory entry has configured (e.g. a
    // back-office partner who should also see incoming requests but
    // isn't shown as the public contact).
    try {
      await sendRecommendationRequestEmail({
        to: profile.user.email,
        bcc: profile.notifyEmails,
        requesterName,
        requesterEmail,
        requesterCompany,
        contractType: subject,
        governingLaw: governingLaw ?? "Cross-jurisdiction",
        message,
        sourceApp: auth.customer.name,
      });
    } catch {
      logger.error("Failed to send contact request email");
    }

    return NextResponse.json(
      {
        requestId: request.id,
        status: request.status,
        createdAt: request.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Error creating contact request", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
