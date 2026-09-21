// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSupervisorSession } from "@/lib/portal-session";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { verifySupervisorToken } from "@/lib/totp-supervisor";
import {
  SECOND_FACTOR_COOKIE,
  SECOND_FACTOR_MAX_AGE_SECONDS,
  issueSecondFactor,
} from "@/lib/portal-2fa";
import { claimSecondFactorAttempt } from "@/server/services/second-factor";
import { tooManyRequests } from "@/server/middleware/public-rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Require a TOTP code in the request body. The gate cookie is the second
    // factor for /supervise, so it must never be issued without a code that is
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

    const cookieStore = await cookies();
    // Only a token issued by the supervisor sign-in reads as a session.
    const supervisorSession = await readSupervisorSession(
      cookieStore.get("supervisor_session")?.value
    );

    // The gate is bound to the sign-in, so a session without an id cannot pass it.
    if (!supervisorSession?.sid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get supervisor by ID
    const supervisor = await prisma.supervisor.findUnique({
      where: { id: supervisorSession.supervisorId },
      include: { twoFactorSecret: true },
    });

    if (!supervisor || !supervisor.isActive) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify that the supervisor has a verified 2FA secret
    if (!supervisor.twoFactorSecret?.verified) {
      return NextResponse.json({ error: "2FA not verified" }, { status: 400 });
    }

    // A six-digit code can be guessed: limit the tries per supervisor. Fails
    // closed (the throw lands in apiError) if the counter is unavailable.
    const attempt = await claimSecondFactorAttempt("supervisor", supervisor.id);
    if (!attempt.allowed) return tooManyRequests(attempt);

    // Verify the TOTP code against the stored secret before granting the gate
    if (!verifySupervisorToken(supervisor.twoFactorSecret.secret, code)) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });

    // Signed, bound to this supervisor and this sign-in, expiry inside the
    // signature (4 hours). httpOnly as before.
    response.cookies.set(
      SECOND_FACTOR_COOKIE.supervisor,
      await issueSecondFactor("supervisor", supervisor.id, supervisorSession.sid),
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
  response.cookies.delete(SECOND_FACTOR_COOKIE.supervisor);

  return response;
}
