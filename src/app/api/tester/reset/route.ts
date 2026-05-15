/**
 * Tester data reset — wipes all deals, invitations and signing artefacts
 * owned by the current tester user, so the next click can start from a
 * clean slate. Only callable when:
 *  - `TESTER_MODE_ENABLED=true` on the server
 *  - The caller's session email is on the tester allowlist
 *
 * Returns 404 when tester mode is off (don't advertise the endpoint),
 * 401 when unauthenticated, 403 when the session is for a non-tester
 * email, 200 with a summary on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { isTesterEmail, isTesterModeServer } from "@/lib/tester";

export async function POST(_req: NextRequest) {
  try {
    if (!isTesterModeServer()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isTesterEmail(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const userId = user.id;

    // Deal rooms where this tester is the INITIATOR — cascades take care of
    // clauses, selections, compromises, rounds, signing requests, parties.
    const ownedRooms = await prisma.dealRoomParty.findMany({
      where: { userId, role: "INITIATOR" },
      select: { dealRoomId: true },
    });
    const ownedRoomIds = ownedRooms.map((p) => p.dealRoomId);

    const result = await prisma.$transaction(async (tx) => {
      // Remove invitations the tester sent.
      const invitations = await tx.invitation.deleteMany({
        where: { sentById: userId },
      });

      // Detach the tester from any RESPONDENT party rows so the deal still
      // exists for the initiator counterparty but the tester is unlinked.
      const detached = await tx.dealRoomParty.updateMany({
        where: { userId, role: "RESPONDENT" },
        data: { userId: null, status: "PENDING" },
      });

      // Delete owned deal rooms (cascade handles the rest).
      const rooms = await tx.dealRoom.deleteMany({
        where: { id: { in: ownedRoomIds } },
      });

      // Audit logs by this user (their stamp on actions).
      const auditLogs = await tx.auditLog.deleteMany({ where: { userId } });

      return {
        invitationsDeleted: invitations.count,
        respondentSlotsDetached: detached.count,
        dealRoomsDeleted: rooms.count,
        auditLogsDeleted: auditLogs.count,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return apiError(error, "Failed to reset tester data.");
  }
}
