// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Server-side second-factor checks for the admin and supervisor portals.
 *
 * `requireAdminSecondFactor` / `requireSupervisorSecondFactor` are what a
 * tRPC procedure calls before doing privileged work: the signed gate cookie
 * must verify for this admin/supervisor and this sign-in (portal-2fa.ts), and
 * the account must still be active. Anything else is FORBIDDEN.
 *
 * `claimSecondFactorAttempt` limits how many TOTP codes one first-factor
 * session holder can try. The REST verify routes and the tRPC enrolment
 * `verify` procedures share one bucket per subject, because either one tells
 * the caller whether a code was right. Unlike the public limits it fails
 * closed: if the counter cannot be written, no code is checked.
 */

import { TRPCError } from "@trpc/server";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { SECOND_FACTOR_COOKIE, verifySecondFactor, type Portal } from "@/lib/portal-2fa";
import type { AdminPortalSession, SupervisorPortalSession } from "@/lib/portal-session";
import { claimSlot, type RateLimitResult } from "@/server/middleware/apiKeyAuth";

type GetCookie = (name: string) => string | undefined;

export const requireAdminSecondFactor = async (
  session: AdminPortalSession,
  getCookie: GetCookie,
  prisma: ExtendedPrismaClient
) => {
  const verified = await verifySecondFactor(
    "admin",
    session.adminId,
    session.sid,
    getCookie(SECOND_FACTOR_COOKIE.admin)
  );
  if (!verified) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "2FA verification required",
    });
  }

  const admin = await prisma.platformAdmin.findUnique({
    where: { id: session.adminId },
  });

  if (!admin || !admin.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Platform admin access required",
    });
  }

  return admin;
};

export const requireSupervisorSecondFactor = async (
  session: SupervisorPortalSession,
  getCookie: GetCookie,
  prisma: ExtendedPrismaClient
) => {
  const verified = await verifySecondFactor(
    "supervisor",
    session.supervisorId,
    session.sid,
    getCookie(SECOND_FACTOR_COOKIE.supervisor)
  );
  if (!verified) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "2FA verification required",
    });
  }

  const supervisor = await prisma.supervisor.findUnique({
    where: { id: session.supervisorId },
  });

  if (!supervisor || !supervisor.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Supervisor access required",
    });
  }

  return supervisor;
};

/**
 * Ten checks per subject per fifteen minutes. A normal sign-in spends two
 * (the enrolment `verify` procedure, then the REST route that sets the
 * cookie), so this allows five tries. Throws if the counter is unavailable.
 */
export const SECOND_FACTOR_ATTEMPTS = { limit: 10, windowMs: 15 * 60_000 };

export function claimSecondFactorAttempt(
  portal: Portal,
  subjectId: string
): Promise<RateLimitResult> {
  return claimSlot(
    `second-factor:${portal}:${subjectId}`,
    SECOND_FACTOR_ATTEMPTS.limit,
    SECOND_FACTOR_ATTEMPTS.windowMs
  );
}
