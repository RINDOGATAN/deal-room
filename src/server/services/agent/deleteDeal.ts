// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API: delete one of the caller's single-party deals and its data
 * (owner's decision, 2026-10-06). First user: an MCP server that deletes
 * its client's facts 30 days after release.
 *
 * Only the account that created the deal (the initiator customer) may
 * delete it; for anyone else the deal does not exist (404). A deal another
 * party takes part in (a two-party negotiation, a respondent, a dispute, an
 * accepted invitation) is refused with 409: its data is not only ours.
 *
 * Deleted: the agent deal (names, e-mails, negotiation log), the deal room
 * and everything that cascades from it (parties with their signing
 * details, the counterparty block `soloCounterparty`, clauses, selections,
 * compromise suggestions, rounds, counter-proposals, parameter proposals,
 * inputs, invitations, the signing request with its signatures,
 * supervisor assignments, notification claims), every audit log entry of
 * the deal, and the cached idempotent answers that hold the deal.
 * Documents are rendered on request and never stored, so there is no file
 * to remove.
 *
 * Kept, because billing and the law need them: each payment row, copied to
 * `deleted_deal_payments` before the cascade removes it (amount, currency,
 * date, account, Stripe references, deal id); the credit ledger
 * (`customer_credit_entries`), which has no foreign key to the deal;
 * the usage meter (`negotiation_usage`: contract type, law, outcome); the
 * AI usage metadata (`ai_generations`, no prompt or text, its deal link set
 * to null by the schema); and one new audit entry recording the deletion
 * with ids only.
 */

import { DealMode, PartyRole } from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/prisma";

export type DeleteDealResult =
  | { ok: true; status: 204; dealRoomId: string | null; paymentsKept: number }
  | { ok: false; status: 404 | 409; error: string; code: string };

const NOT_FOUND: DeleteDealResult = {
  ok: false,
  status: 404,
  error: "Deal not found",
  code: "NOT_FOUND",
};

const NOT_SINGLE_PARTY: DeleteDealResult = {
  ok: false,
  status: 409,
  error:
    "Only single-party deals can be deleted. Another party takes part in this deal, so its data is not only yours to delete.",
  code: "NOT_SINGLE_PARTY",
};

export async function deleteAgentDeal(
  db: ExtendedPrismaClient,
  customerId: string,
  agentDealId: string,
): Promise<DeleteDealResult> {
  const agentDeal = await db.agentDealRoom.findUnique({
    where: { id: agentDealId },
    select: {
      id: true,
      dealRoomId: true,
      initiatorCustomerId: true,
      respondentCustomerId: true,
      initiatorPlaybookId: true,
      respondentPlaybookId: true,
      negotiationToken: true,
      dispute: { select: { id: true } },
      dealRoom: {
        select: {
          id: true,
          dealMode: true,
          parties: { select: { role: true } },
          invitations: { where: { status: "ACCEPTED" }, select: { id: true } },
        },
      },
    },
  });

  // Not the caller's deal: say nothing about whether it exists.
  if (!agentDeal || agentDeal.initiatorCustomerId !== customerId) return NOT_FOUND;

  const room = agentDeal.dealRoom;
  const singleParty =
    !!room &&
    room.dealMode === DealMode.SOLO &&
    !agentDeal.respondentCustomerId &&
    !agentDeal.initiatorPlaybookId &&
    !agentDeal.respondentPlaybookId &&
    !agentDeal.dispute &&
    room.parties.every((p) => p.role === PartyRole.INITIATOR) &&
    room.invitations.length === 0;
  if (!singleParty) return NOT_SINGLE_PARTY;

  const dealRoomId = room.id;
  const ids = [agentDeal.id, dealRoomId, agentDeal.negotiationToken];

  const paymentsKept = await db.$transaction(async (tx) => {
    // 1. The billing record survives the cascade, without names or text.
    const payments = await tx.dealPayment.findMany({ where: { dealRoomId } });
    if (payments.length > 0) {
      await tx.deletedDealPayment.createMany({
        data: payments.map((p) => ({
          id: p.id,
          dealRoomId: p.dealRoomId,
          agentDealRoomId: agentDeal.id,
          payerUserId: p.payerUserId,
          payerApiKeyId: p.payerApiKeyId,
          customerId: p.customerId,
          kind: p.kind,
          status: p.status,
          stripeCheckoutSessionId: p.stripeCheckoutSessionId,
          stripePaymentIntentId: p.stripePaymentIntentId,
          stripeSubscriptionId: p.stripeSubscriptionId,
          amount: p.amount,
          currency: p.currency,
          paidAt: p.paidAt,
          revokedAt: p.revokedAt,
          revokedReason: p.revokedReason,
          createdAt: p.createdAt,
        })),
        skipDuplicates: true,
      });
    }

    // 2. Cached idempotent answers of this customer that hold the deal
    //    (the creation answer carries names, terms and, inline, the text).
    await tx.idempotencyRecord.deleteMany({
      where: {
        customerId,
        OR: ids.flatMap((id) => [{ responseBody: { contains: id } }, { path: { contains: id } }]),
      },
    });

    // 3. The deal's audit entries: their details may name the parties. The
    //    schema would only unlink them (SET NULL), so they go first.
    await tx.auditLog.deleteMany({
      where: {
        OR: [
          { dealRoomId },
          { details: { path: ["agentDealRoomId"], equals: agentDeal.id } },
        ],
      },
    });

    // 4. The agent deal (company names, e-mails, negotiation log), then the
    //    deal room, whose children cascade.
    await tx.agentDealRoom.delete({ where: { id: agentDeal.id } });
    await tx.dealRoom.delete({ where: { id: dealRoomId } });

    // 5. One entry that the deletion happened, ids only.
    await tx.auditLog.create({
      data: {
        action: "AGENT_DEAL_DELETED",
        details: {
          customerId,
          agentDealRoomId: agentDeal.id,
          deletedDealRoomId: dealRoomId,
          paymentsKept: payments.length,
        },
      },
    });

    return payments.length;
  });

  return { ok: true, status: 204, dealRoomId, paymentsKept };
}
