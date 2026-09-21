// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { verifyAdminToken } from "@/lib/totp-admin";
import { readAdminSession } from "@/lib/portal-session";
import {
  SECOND_FACTOR_COOKIE,
  SECOND_FACTOR_MAX_AGE_SECONDS,
  issueSecondFactor,
} from "@/lib/portal-2fa";
import { claimSecondFactorAttempt } from "@/server/services/second-factor";
import { tooManyRequests } from "@/server/middleware/public-rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Only a token issued by the admin sign-in reads as a session. The gate
    // is bound to that sign-in, so a session without an id cannot pass it.
    const cookieStore = await cookies();
    const session = await readAdminSession(cookieStore.get("admin_session")?.value);

    if (!session?.sid) {
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

    // Get platform admin by id
    const admin = await prisma.platformAdmin.findUnique({
      where: { id: session.adminId },
      include: { twoFactorSecret: true },
    });

    if (!admin || !admin.isActive) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify that the admin has a verified 2FA secret
    if (!admin.twoFactorSecret?.verified) {
      return NextResponse.json({ error: "2FA not verified" }, { status: 400 });
    }

    // A six-digit code can be guessed: limit the tries per admin. Fails
    // closed (the throw lands in apiError) if the counter is unavailable.
    const attempt = await claimSecondFactorAttempt("admin", admin.id);
    if (!attempt.allowed) return tooManyRequests(attempt);

    // Verify the TOTP code against the stored secret before granting the gate
    if (!verifyAdminToken(admin.twoFactorSecret.secret, code)) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });

    // Signed, bound to this admin and this sign-in, expiry inside the
    // signature (4 hours). httpOnly as before.
    response.cookies.set(
      SECOND_FACTOR_COOKIE.admin,
      await issueSecondFactor("admin", admin.id, session.sid),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SECOND_FACTOR_MAX_AGE_SECONDS,
        path: "/",
      }
    );

    return response;
  } catch (error) {
    return apiError(error, "2FA verification failed");
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  // Clear the 2FA verification cookie
  response.cookies.delete(SECOND_FACTOR_COOKIE.admin);

  return response;
}
