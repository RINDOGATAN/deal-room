// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { adminAuthOptions } from "@/lib/auth-admin";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { verifyAdminToken } from "@/lib/totp-admin";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(adminAuthOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Require a TOTP code in the request body. The gate cookie is the second
    // factor for /admin, so it must never be issued without a code that is
    // verified server-side against the stored secret.
    let code: unknown;
    try {
      ({ code } = await request.json());
    } catch {
      return NextResponse.json({ error: "Verification code required" }, { status: 400 });
    }
    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Verification code required" }, { status: 400 });
    }

    // Get platform admin by email
    const admin = await prisma.platformAdmin.findUnique({
      where: { email: session.user.email.toLowerCase() },
      include: { twoFactorSecret: true },
    });

    if (!admin || !admin.isActive) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify that the admin has a verified 2FA secret
    if (!admin.twoFactorSecret?.verified) {
      return NextResponse.json({ error: "2FA not verified" }, { status: 400 });
    }

    // Verify the TOTP code against the stored secret before granting the gate
    if (!verifyAdminToken(admin.twoFactorSecret.secret, code)) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });

    // Set secure httpOnly cookie that expires in 4 hours
    response.cookies.set("platform_admin_2fa_verified", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 4 * 60 * 60, // 4 hours in seconds
      path: "/",
    });

    return response;
  } catch (error) {
    return apiError(error, "2FA verification failed");
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  // Clear the 2FA verification cookie
  response.cookies.delete("platform_admin_2fa_verified");

  return response;
}
