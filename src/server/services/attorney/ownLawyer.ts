// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Invite your own lawyer" (owner's decision E1, step 1, 6 October 2026).
 *
 * A party invites any lawyer it chooses, by e-mail, to review the draft in
 * the existing attorney review: the lawyer becomes a supervisor of this
 * one deal (a `Supervisor` row found or created by e-mail, with no bar
 * admission, so it never appears in the attorney list of any other deal),
 * the party's review is marked requested, and the lawyer receives the
 * invitation through the same transactional e-mail path as the attorney
 * review request. The lawyer then signs in to the supervisor portal and
 * approves or not, exactly as in the existing flow; until then, signing
 * waits, and the party can cancel as before.
 *
 * The lawyer works for the client and bills the client directly. Dealroom
 * takes no fee, makes no recommendation, keeps no directory and charges
 * nothing per invitation. The same rules apply to every jurisdiction.
 */

import type { ExtendedPrismaClient } from "@/lib/prisma";
import { sendOwnLawyerInviteEmail } from "@/lib/email";
import { createLogger } from "@/lib/logger";

const logger = createLogger("own-lawyer");

/** The one plain sentence shown wherever a lawyer is invited. */
export const OWN_LAWYER_NOTE = {
  en: "The lawyer you invite works for you and bills you directly; Dealroom takes no fee and makes no recommendation.",
  es: "El abogado o la abogada que invites trabaja para ti y te factura directamente; Dealroom no cobra nada por ello ni hace recomendaciones.",
} as const;

/** Invitations one deal may send in 24 hours (cancel and invite again included). */
export const MAX_INVITES_PER_DAY = 5;

export const OWN_LAWYER_AUDIT_ACTION = "ATTORNEY_INVITED_BY_PARTY";

export type InviteOwnLawyerResult =
  | { ok: true; supervisorId: string; lawyerEmail: string; emailSent: boolean }
  | { ok: false; status: 400 | 403 | 404 | 409 | 429; code: string; error: string };

const fail = (
  status: 400 | 403 | 404 | 409 | 429,
  code: string,
  error: string,
): InviteOwnLawyerResult => ({ ok: false, status, code, error });

export async function inviteOwnLawyer(
  db: ExtendedPrismaClient,
  input: {
    /** The inviting party (its own review). */
    partyId: string;
    lawyerEmail: string;
    lawyerName?: string | null;
    /** The signed-in user who invites, when it is a person. */
    actorUserId?: string | null;
    /** Who asked: a person in Dealroom or an agent through the API. */
    via: "app" | "agent";
    lang?: string;
  },
): Promise<InviteOwnLawyerResult> {
  const email = input.lawyerEmail.trim().toLowerCase();
  const party = await db.dealRoomParty.findUnique({
    where: { id: input.partyId },
    include: { dealRoom: { include: { parties: true } } },
  });
  if (!party) return fail(404, "NOT_FOUND", "Deal not found");

  const deal = party.dealRoom;
  if (deal.status === "CANCELLED" || deal.status === "COMPLETED") {
    return fail(409, "DEAL_CLOSED", "This deal is closed; its draft can no longer be reviewed");
  }
  // The same gate as the attorney review request.
  if (!["SUBMITTED", "REVIEWING", "ACCEPTED"].includes(party.status) && deal.status !== "AGREED") {
    return fail(409, "NOT_READY", "Submit your selections before inviting a lawyer to review");
  }
  if (party.attorneyReviewRequested) {
    return fail(409, "REVIEW_ALREADY_REQUESTED", "A review is already requested for your side; cancel it first to invite another lawyer");
  }
  if (deal.parties.some((p) => p.id !== party.id && p.email.toLowerCase() === email)) {
    return fail(400, "OTHER_PARTY_EMAIL", "This is the other party's e-mail address");
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db.auditLog.count({
    where: { dealRoomId: deal.id, action: OWN_LAWYER_AUDIT_ACTION, createdAt: { gte: since } },
  });
  if (recent >= MAX_INVITES_PER_DAY) {
    return fail(429, "TOO_MANY_INVITATIONS", "Too many invitations for this deal today; try again tomorrow");
  }

  let supervisor = await db.supervisor.findUnique({ where: { email } });
  if (supervisor && !supervisor.isActive) {
    return fail(409, "LAWYER_UNAVAILABLE", "This e-mail address cannot be invited");
  }
  const created = !supervisor;
  if (!supervisor) {
    supervisor = await db.supervisor.create({
      data: { email, name: input.lawyerName?.trim() || null, isActive: true },
    });
  }

  const other = deal.parties.find((p) => p.id !== party.id);
  if (other?.attorneySupervisorId === supervisor.id) {
    return fail(409, "LAWYER_ACTS_FOR_OTHER_PARTY", "This lawyer is already reviewing for the other party");
  }

  await db.$transaction([
    db.dealRoomParty.update({
      where: { id: party.id },
      data: {
        attorneyReviewRequested: true,
        attorneyReviewRequestedAt: new Date(),
        attorneySupervisorId: supervisor.id,
      },
    }),
    // Party-initiated (assignedBy null), so cancelling the review removes it.
    db.supervisorAssignment.upsert({
      where: { supervisorId_dealRoomId: { supervisorId: supervisor.id, dealRoomId: deal.id } },
      update: {},
      create: { supervisorId: supervisor.id, dealRoomId: deal.id, assignedBy: null },
    }),
    db.auditLog.create({
      data: {
        dealRoomId: deal.id,
        userId: input.actorUserId ?? null,
        action: OWN_LAWYER_AUDIT_ACTION,
        details: {
          supervisorId: supervisor.id,
          partyRole: party.role,
          via: input.via,
          newLawyerAccount: created,
        },
      },
    }),
  ]);

  const emailSent = await sendOwnLawyerInviteEmail({
    to: supervisor.email,
    lawyerName: supervisor.name,
    partyName: party.company || party.name || party.email,
    dealName: deal.name || "Untitled deal",
    lang: input.lang,
  }).catch((err) => {
    logger.error("Own-lawyer invitation e-mail failed", { err: String(err) });
    return false;
  });

  return { ok: true, supervisorId: supervisor.id, lawyerEmail: supervisor.email, emailSent };
}
