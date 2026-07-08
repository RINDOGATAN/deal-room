// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createPortalSession } from "@/lib/stripe";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  if (!features.stripeEnabled) {
    return NextResponse.json(
      { error: "Self-service billing is not enabled" },
      { status: 403 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customer = await prisma.customer.findFirst({
      where: { email: { equals: session.user.email, mode: "insensitive" } },
    });

    if (!customer?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 404 }
      );
    }

    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL;
    const portalSession = await createPortalSession(
      customer.stripeCustomerId,
      `${origin}/billing`
    );

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    return apiError(error, "Failed to create portal session");
  }
}
