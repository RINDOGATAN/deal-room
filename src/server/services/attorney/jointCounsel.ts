// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Joint closing counsel (Stage B) by invitation (owner's decision,
 * 6 October 2026): the initiator names a lawyer by e-mail instead of
 * picking one from a platform list. The other party then acknowledges or
 * declines, exactly as before; a pending request blocks signing.
 *
 * The lawyer works for both parties and bills them directly. Dealroom
 * keeps no list, makes no recommendation and takes no fee. A lawyer who
 * reviewed for either party (Stage A) cannot act as joint counsel, and a
 * party's own address cannot be named. One request per deal: a decline is
 * final and the parties go on to sign without joint counsel.
 */

import type { ExtendedPrismaClient } from "@/lib/prisma";
import {
  sendJointCounselInviteEmail,
  sendJointCounselNotificationEmail,
} from "@/lib/email";
import { createLogger } from "@/lib/logger";
import { findOrCreateInvitedLawyer } from "./ownLawyer";

const logger = createLogger("joint-counsel");

/** The one plain sentence shown where the joint closing lawyer is named. */
export const JOINT_COUNSEL_NOTE = {
  en: "The lawyer you name works for both parties and bills them directly; Dealroom takes no fee and makes no recommendation.",
  es: "El abogado o la abogada que propongas trabaja para ambas partes y os factura directamente; Dealroom no cobra nada por ello ni hace recomendaciones.",
} as const;

export const JOINT_COUNSEL_AUDIT_ACTION = "JOINT_COUNSEL_REQUESTED";

export type RequestJointCounselResult =
  | { ok: true; supervisorId: string; lawyerEmail: string; emailSent: boolean }
  | { ok: false; status: 400 | 403 | 404 | 409; code: string; error: string };

const fail = (
  status: 400 | 403 | 404 | 409,
  code: string,
  error: string,
): RequestJointCounselResult => ({ ok: false, status, code, error });

export async function requestJointCounsel(
  db: ExtendedPrismaClient,
  input: {
    /** The requesting party (must be the initiator). */
    partyId: string;
    lawyerEmail: string;
    lawyerName?: string | null;
    actorUserId?: string | null;
    lang?: string;
  },
): Promise<RequestJointCounselResult> {
  const email = input.lawyerEmail.trim().toLowerCase();
  const party = await db.dealRoomParty.findUnique({
    where: { id: input.partyId },
    include: { dealRoom: { include: { parties: true } } },
  });
  if (!party) return fail(404, "NOT_FOUND", "Deal not found");

  const deal = party.dealRoom;
  if (deal.status !== "AGREED") {
    return fail(409, "NOT_AGREED", "Deal must be in AGREED status");
  }
  if (party.role !== "INITIATOR") {
    return fail(403, "NOT_INITIATOR", "Only the initiator can request joint closing counsel");
  }
  if (deal.jointCounselRequestedAt || deal.jointCounselSupervisorId) {
    return fail(409, "ALREADY_REQUESTED", "Joint closing counsel has already been requested for this deal");
  }
  if (deal.parties.some((p) => p.email.toLowerCase() === email)) {
    return fail(400, "PARTY_EMAIL", "This is the e-mail address of a party to this deal");
  }

  const found = await findOrCreateInvitedLawyer(db, email, input.lawyerName);
  if (!found) {
    return fail(409, "LAWYER_UNAVAILABLE", "This e-mail address cannot be invited");
  }
  const { supervisor, created } = found;

  if (deal.parties.some((p) => p.attorneySupervisorId === supervisor.id)) {
    return fail(409, "LAWYER_ACTED_FOR_A_PARTY", "This lawyer reviewed the contract for one of the parties and cannot act as joint counsel");
  }

  await db.$transaction([
    db.dealRoom.update({
      where: { id: deal.id },
      data: {
        jointCounselSupervisorId: supervisor.id,
        jointCounselRequestedAt: new Date(),
        jointCounselRequestedBy: party.id,
      },
    }),
    // Party-initiated (assignedBy null), so a decline removes it.
    db.supervisorAssignment.upsert({
      where: { supervisorId_dealRoomId: { supervisorId: supervisor.id, dealRoomId: deal.id } },
      update: {},
      create: { supervisorId: supervisor.id, dealRoomId: deal.id, assignedBy: null },
    }),
    db.auditLog.create({
      data: {
        dealRoomId: deal.id,
        userId: input.actorUserId ?? null,
        action: JOINT_COUNSEL_AUDIT_ACTION,
        details: {
          supervisorId: supervisor.id,
          partyRole: party.role,
          invitedByEmail: true,
          newLawyerAccount: created,
        },
      },
    }),
  ]);

  const initiatorName = party.company || party.name || party.email;
  const dealName = deal.name || "Untitled deal";

  const emailSent = await sendJointCounselInviteEmail({
    to: supervisor.email,
    lawyerName: supervisor.name,
    partyName: initiatorName,
    dealName,
    lang: input.lang,
  }).catch((err) => {
    logger.error("Joint counsel invitation e-mail failed", { err: String(err) });
    return false;
  });

  const other = deal.parties.find((p) => p.id !== party.id);
  if (other?.email) {
    sendJointCounselNotificationEmail({
      to: other.email,
      partyName: other.name || other.email,
      dealName,
      supervisorName: supervisor.name || supervisor.email,
      dealRoomId: deal.id,
    }).catch((err) =>
      logger.error("Failed to send joint counsel notification email", { err: String(err) }),
    );
  }

  return { ok: true, supervisorId: supervisor.id, lawyerEmail: supervisor.email, emailSent };
}
