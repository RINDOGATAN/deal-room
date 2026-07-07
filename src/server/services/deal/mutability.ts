// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Deal mutability guard — server-side enforcement that mutations cannot
 * touch a deal once it has reached a terminal state.
 *
 * UI guards keep most mutations off-screen for COMPLETED / CANCELLED deals,
 * but anything that bypasses the UI (direct tRPC call, an old browser tab,
 * a forged request) would otherwise mutate state on a sealed deal. This
 * helper is the durable safeguard.
 *
 * Use at the top of every clause/selection/compromise mutation that
 * shouldn't run after a deal is sealed. Reads only the `status` field,
 * so the cost is one short index lookup.
 */
import { TRPCError } from "@trpc/server";
import type { DealRoomStatus } from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/prisma";

const TERMINAL_STATUSES = new Set<DealRoomStatus>(["COMPLETED", "CANCELLED"]);

export function isTerminalStatus(status: DealRoomStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Pure throw variant. Use when the caller already has the deal status
 * loaded from a previous read — avoids a redundant DB round trip.
 */
export function assertMutableStatus(status: DealRoomStatus): void {
  if (isTerminalStatus(status)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        status === "COMPLETED"
          ? "This deal is completed and can no longer be edited."
          : "This deal has been cancelled and can no longer be edited.",
    });
  }
}

/**
 * Throws TRPCError("PRECONDITION_FAILED") if the deal is in a terminal
 * state. Returns the resolved status so callers can avoid a second read.
 *
 * Throws NOT_FOUND if the deal doesn't exist — matches the pattern most
 * mutations use elsewhere.
 */
export async function assertDealMutable(
  prisma: ExtendedPrismaClient,
  dealRoomId: string,
): Promise<DealRoomStatus> {
  const deal = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    select: { status: true },
  });
  if (!deal) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Deal room not found" });
  }
  if (isTerminalStatus(deal.status)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        deal.status === "COMPLETED"
          ? "This deal is completed and can no longer be edited."
          : "This deal has been cancelled and can no longer be edited.",
    });
  }
  return deal.status;
}
