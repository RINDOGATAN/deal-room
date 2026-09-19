// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Hosted pilot caps applied to the database. Rules live in
 * `src/lib/pilot.ts`; every function here is a no-op answer on the kit
 * (`features.hostedPilot` false), so self-hosted installs are never capped.
 */

import { TRPCError } from "@trpc/server";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { features } from "@/config/features";
import {
  PILOT_CAPS,
  pilotCapMessage,
  pilotEditWindow,
  pilotHasRoom,
  type PilotCapReason,
  type PilotRecordKind,
} from "@/lib/pilot";

/** Carried on the tRPC error so the interface can show the translated text. */
export class PilotCapError extends Error {
  constructor(public readonly reason: PilotCapReason) {
    super(pilotCapMessage(reason));
    this.name = "PilotCapError";
  }
}

function pilotError(reason: PilotCapReason): TRPCError {
  const cause = new PilotCapError(reason);
  return new TRPCError({ code: "FORBIDDEN", message: cause.message, cause });
}

/**
 * The account's first sign-in while the pilot runs (`users.pilotStartedAt`,
 * written by the sign-in event in `auth.ts`). The account's creation date
 * and any sign-in before the pilot (`lastLoginAt`) are never used. A session
 * that predates the pilot has no pilot sign-in yet, so its first
 * authenticated request is recorded as that sign-in. The edit window itself
 * opens at `pilotWindowStart()`: this date, or the deployment date if later.
 */
export async function ensurePilotStartedAt(
  prisma: ExtendedPrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<Date> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pilotStartedAt: true },
  });
  if (user?.pilotStartedAt) return user.pilotStartedAt;
  // Only fill an empty value, so two concurrent first requests agree.
  await prisma.user.updateMany({
    where: { id: userId, pilotStartedAt: null },
    data: { pilotStartedAt: now },
  });
  const fresh = await prisma.user.findUnique({
    where: { id: userId },
    select: { pilotStartedAt: true },
  });
  return fresh?.pilotStartedAt ?? now;
}

/** Records the account has created, counted against the ceilings. */
export async function countPilotRecords(
  prisma: ExtendedPrismaClient,
  userId: string,
): Promise<Record<PilotRecordKind, number>> {
  const [deals, journeys] = await Promise.all([
    // Deals the account started. Deals it was invited to belong to the
    // other party's pilot and do not count here. Cancelled deals still
    // count, so cancelling does not reopen the ceiling.
    prisma.dealRoom.count({
      where: { parties: { some: { userId, role: "INITIATOR" } } },
    }),
    prisma.startupJourney.count({ where: { userId } }),
  ]);
  return { deals, journeys };
}

export interface PilotStatus {
  hosted: boolean;
  startedAt: Date | null;
  endsAt: Date | null;
  daysLeft: number | null;
  readOnly: boolean;
  organisations: { used: number; limit: number };
  deals: { used: number; limit: number };
  journeys: { used: number; limit: number };
}

export async function getPilotStatus(
  prisma: ExtendedPrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<PilotStatus> {
  if (!features.hostedPilot) {
    return {
      hosted: false,
      startedAt: null,
      endsAt: null,
      daysLeft: null,
      readOnly: false,
      organisations: { used: 1, limit: PILOT_CAPS.organisationsPerAccount },
      deals: { used: 0, limit: PILOT_CAPS.deals },
      journeys: { used: 0, limit: PILOT_CAPS.journeys },
    };
  }
  const firstSignInAt = await ensurePilotStartedAt(prisma, userId, now);
  const window = pilotEditWindow(firstSignInAt, now);
  const counts = await countPilotRecords(prisma, userId);
  return {
    hosted: true,
    startedAt: window.startedAt,
    endsAt: window.endsAt,
    daysLeft: window.daysLeft,
    readOnly: window.readOnly,
    organisations: { used: 1, limit: PILOT_CAPS.organisationsPerAccount },
    deals: { used: counts.deals, limit: PILOT_CAPS.deals },
    journeys: { used: counts.journeys, limit: PILOT_CAPS.journeys },
  };
}

/** Whether the account is past its edit window (always false on the kit). */
export async function isPilotReadOnly(
  prisma: ExtendedPrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (!features.hostedPilot) return false;
  const firstSignInAt = await ensurePilotStartedAt(prisma, userId, now);
  return pilotEditWindow(firstSignInAt, now).readOnly;
}

/** Throws FORBIDDEN when the account is past its edit window. */
export async function assertPilotCanEdit(
  prisma: ExtendedPrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  if (await isPilotReadOnly(prisma, userId, now)) throw pilotError("read_only");
}

/** Throws FORBIDDEN when `adding` more records would pass the ceiling. */
export async function assertPilotRecordRoom(
  prisma: ExtendedPrismaClient,
  userId: string,
  kind: PilotRecordKind,
  adding = 1,
): Promise<void> {
  if (!features.hostedPilot) return;
  const counts = await countPilotRecords(prisma, userId);
  if (!pilotHasRoom(kind, counts[kind], adding)) throw pilotError(kind);
}
