// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Transactional deal emails (owner decisions of 4 October 2026): sending
 * and recording. The rules are in `src/lib/deal-notifications.ts`.
 *
 * Every email is claimed first by writing its row in `deal_notifications`
 * (the dedupe key is unique), then sent; when the send fails the claim is
 * released so a later run can try again. Two runs, or two requests, can
 * therefore never send the same email twice.
 *
 * Nothing here throws into the caller: a failed email is logged and the
 * negotiation step that triggered it goes on.
 */

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { features } from "@/config/features";
import { createLogger } from "@/lib/logger";
import { sendDealEmail, type DealEmailInput } from "@/lib/email";
import { billingStartDate, displayPrice, preferredCurrency } from "@/lib/contract-billing";
import { toBillingCurrency } from "@/lib/currency";
import {
  DAY_MS,
  INVITE_DAY3,
  DRAFT_IDLE_DAYS,
  dealEmailsAllowed,
  dedupeKeys,
  draftReminderDue,
  emailLanguage,
  inviteReminderDue,
  lastActivity,
  partyEmail,
  partyName,
  readyEmailDue,
  readyRecipients,
  recipientCurrency,
  turnRecipient,
  type NotificationKind,
  type PartyLike,
} from "@/lib/deal-notifications";
import { getPriceTable } from "../billing/pricing";
import { isDealPaid } from "../billing/deal-entitlement";

const logger = createLogger("deal-emails");

export interface JobResult {
  ran: number;
  errors: number;
}

type Outcome = "sent" | "skipped" | "failed";

function appUrl(path: string): string {
  return `${process.env.NEXTAUTH_URL ?? ""}${path}`;
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** Claim, send, and release the claim if the send failed. */
async function deliver(opts: {
  dealRoomId: string;
  kind: NotificationKind;
  to: string;
  dedupeKey: string;
  email: DealEmailInput;
}): Promise<Outcome> {
  try {
    await prisma.dealNotification.create({
      data: {
        dealRoomId: opts.dealRoomId,
        kind: opts.kind,
        recipientEmail: opts.to,
        dedupeKey: opts.dedupeKey,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return "skipped";
    throw err;
  }

  const ok = await sendDealEmail(opts.to, opts.email);
  if (!ok) {
    await prisma.dealNotification.deleteMany({ where: { dedupeKey: opts.dedupeKey } });
    return "failed";
  }
  return "sent";
}

const partySelect = {
  id: true,
  role: true,
  userId: true,
  email: true,
  name: true,
  user: { select: { email: true, name: true } },
} as const;

// ────────────────────────────────────────────────────────────
// "Your turn"
// ────────────────────────────────────────────────────────────

/**
 * Tell the other party it is their turn, after `fromPartyId` submitted its
 * clause choices (`TURN_SELECTIONS`) or a counter-proposal in `roundId`
 * (`TURN_COUNTER`, once per round whatever the number of clauses countered).
 */
export async function notifyTurn(opts: {
  dealRoomId: string;
  fromPartyId: string;
  kind: "TURN_SELECTIONS" | "TURN_COUNTER";
  roundId?: string;
}): Promise<Outcome> {
  try {
    const deal = await prisma.dealRoom.findUnique({
      where: { id: opts.dealRoomId },
      select: {
        id: true,
        name: true,
        status: true,
        dealMode: true,
        createdAt: true,
        contractLanguage: true,
        agentDealRoom: { select: { id: true } },
        parties: { select: partySelect },
      },
    });
    if (!deal || deal.dealMode !== "NEGOTIATION") return "skipped";
    if (!["DRAFT", "AWAITING_RESPONSE", "NEGOTIATING"].includes(deal.status)) return "skipped";
    if (!dealEmailsAllowed({ createdAt: deal.createdAt, isAgentDeal: !!deal.agentDealRoom })) return "skipped";

    const parties = deal.parties as PartyLike[];
    const to = turnRecipient(parties, opts.fromPartyId);
    const from = parties.find((p) => p.id === opts.fromPartyId);
    const address = to && partyEmail(to);
    if (!to || !from || !address) return "skipped";

    const key =
      opts.kind === "TURN_COUNTER"
        ? opts.roundId
          ? dedupeKeys.turnCounter(opts.roundId, from.id, to.id)
          : null
        : dedupeKeys.turnSelections(deal.id, from.id, to.id);
    if (!key) return "skipped";

    return await deliver({
      dealRoomId: deal.id,
      kind: opts.kind,
      to: address,
      dedupeKey: key,
      email: {
        kind: opts.kind,
        language: emailLanguage(deal.contractLanguage),
        url: appUrl(`/deals/${deal.id}`),
        dealName: deal.name,
        recipientName: partyName(to),
        otherName: partyName(from),
      },
    });
  } catch (err) {
    logger.error("notifyTurn failed", { dealRoomId: opts.dealRoomId, err: String(err) });
    return "failed";
  }
}

// ────────────────────────────────────────────────────────────
// "Your contract is ready"
// ────────────────────────────────────────────────────────────

/**
 * Tell every party the contract is ready, with the price in their currency
 * and the direct "Get this contract" link. Only while the deal is agreed and
 * unpaid, and payments are on. Once per party.
 */
export async function notifyDealReady(dealRoomId: string): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  try {
    const deal = await prisma.dealRoom.findUnique({
      where: { id: dealRoomId },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        governingLaw: true,
        contractLanguage: true,
        agentDealRoom: { select: { id: true } },
        parties: { select: partySelect },
      },
    });
    if (!deal) return result;
    if (!dealEmailsAllowed({ createdAt: deal.createdAt, isAgentDeal: !!deal.agentDealRoom })) return result;
    const billingOn = features.stripeEnabled;
    if (!billingOn || deal.status !== "AGREED") return result;
    const paid = (await isDealPaid(deal.id)).paid;
    if (!readyEmailDue({ status: deal.status, paid, billingOn })) return result;

    const language = emailLanguage(deal.contractLanguage);
    const table = await getPriceTable().catch(() => null);

    for (const party of readyRecipients(deal.parties as PartyLike[])) {
      const address = partyEmail(party)!;
      const customer = await prisma.customer.findFirst({
        where: { email: { equals: address, mode: "insensitive" } },
        select: { metadata: true },
      });
      const currency = toBillingCurrency(
        recipientCurrency({ stored: preferredCurrency(customer?.metadata), governingLaw: deal.governingLaw }),
      );
      const price = displayPrice("contract", currency, {
        stripeMinor: table?.contract[currency]?.amount,
        locale: language,
      });

      const outcome = await deliver({
        dealRoomId: deal.id,
        kind: "READY",
        to: address,
        dedupeKey: dedupeKeys.ready(deal.id, party.id),
        email: {
          kind: "READY",
          language,
          url: appUrl(`/deals/${deal.id}/sign`),
          dealName: deal.name,
          recipientName: partyName(party),
          price,
        },
      });
      if (outcome === "sent") result.sent++;
      if (outcome === "failed") result.failed++;
    }
  } catch (err) {
    logger.error("notifyDealReady failed", { dealRoomId, err: String(err) });
    result.failed++;
  }
  return result;
}

// ────────────────────────────────────────────────────────────
// Daily cron jobs
// ────────────────────────────────────────────────────────────

/** Invitation reminders, about day 3 and day 10 after an invitation nobody accepted. */
export async function runInvitationReminderJob(now = new Date()): Promise<JobResult> {
  const start = billingStartDate();
  if (!start) return { ran: 0, errors: 0 };
  let ran = 0;
  let errors = 0;

  const invitations = await prisma.invitation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { gt: now },
      sentAt: { lte: new Date(now.getTime() - INVITE_DAY3 * DAY_MS) },
      dealRoom: {
        createdAt: { gte: start },
        status: { notIn: ["CANCELLED", "AGREED", "SIGNING", "COMPLETED"] },
        agentDealRoom: { is: null },
      },
    },
    select: {
      id: true,
      email: true,
      token: true,
      status: true,
      sentAt: true,
      expiresAt: true,
      sentBy: { select: { name: true } },
      dealRoom: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          contractLanguage: true,
          parties: { where: { role: "RESPONDENT" }, select: { userId: true } },
        },
      },
    },
    take: 500,
  });
  if (invitations.length === 0) return { ran, errors };

  const keys = invitations.flatMap((inv) => [
    dedupeKeys.invite("INVITE_DAY3", inv.id),
    dedupeKeys.invite("INVITE_DAY10", inv.id),
  ]);
  const sentRows = await prisma.dealNotification.findMany({
    where: { dedupeKey: { in: keys } },
    select: { dedupeKey: true },
  });
  const sentKeys = new Set(sentRows.map((r) => r.dedupeKey));

  for (const inv of invitations) {
    try {
      // The counterparty already joined (through this or another invitation).
      if (inv.dealRoom.parties.some((p) => !!p.userId)) continue;
      if (!dealEmailsAllowed({ createdAt: inv.dealRoom.createdAt })) continue;

      const alreadySent = new Set<NotificationKind>();
      if (sentKeys.has(dedupeKeys.invite("INVITE_DAY3", inv.id))) alreadySent.add("INVITE_DAY3");
      if (sentKeys.has(dedupeKeys.invite("INVITE_DAY10", inv.id))) alreadySent.add("INVITE_DAY10");
      const kind = inviteReminderDue(inv, now, alreadySent);
      if (!kind) continue;

      const inviter = inv.sentBy?.name?.trim();
      const outcome = await deliver({
        dealRoomId: inv.dealRoom.id,
        kind,
        to: inv.email,
        dedupeKey: dedupeKeys.invite(kind, inv.id),
        email: {
          kind,
          language: emailLanguage(inv.dealRoom.contractLanguage),
          url: appUrl(`/invite/${inv.token}`),
          dealName: inv.dealRoom.name,
          otherName: inviter && !inviter.includes("@") ? inviter : null,
          expiresAt: inv.expiresAt,
        },
      });
      if (outcome === "sent") ran++;
      if (outcome === "failed") errors++;
    } catch (err) {
      errors++;
      logger.error("invitationReminders: failed on invitation", { invitationId: inv.id, err: String(err) });
    }
  }
  return { ran, errors };
}

/** One reminder per unfinished draft, two days after its last activity. */
export async function runDraftReminderJob(now = new Date()): Promise<JobResult> {
  const start = billingStartDate();
  if (!start) return { ran: 0, errors: 0 };
  let ran = 0;
  let errors = 0;

  const drafts = await prisma.dealRoom.findMany({
    where: {
      status: "DRAFT",
      createdAt: { gte: start },
      // The deal row's own last change is a lower bound of the last activity.
      updatedAt: { lte: new Date(now.getTime() - DRAFT_IDLE_DAYS * DAY_MS) },
      agentDealRoom: { is: null },
      notifications: { none: { kind: "DRAFT" } },
    },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      contractLanguage: true,
      parties: {
        select: {
          ...partySelect,
          updatedAt: true,
          selections: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
        },
      },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
    take: 500,
  });

  for (const deal of drafts) {
    try {
      if (!dealEmailsAllowed({ createdAt: deal.createdAt })) continue;
      const lastAt = lastActivity([
        deal.updatedAt,
        deal.auditLogs[0]?.createdAt,
        ...deal.parties.flatMap((p) => [p.updatedAt, p.selections[0]?.updatedAt]),
      ]);
      if (!lastAt || !draftReminderDue({ status: deal.status, lastActivityAt: lastAt }, now, false)) continue;

      const initiator = (deal.parties as PartyLike[]).find((p) => p.role === "INITIATOR");
      const address = initiator && partyEmail(initiator);
      if (!initiator || !address) continue;

      const outcome = await deliver({
        dealRoomId: deal.id,
        kind: "DRAFT",
        to: address,
        dedupeKey: dedupeKeys.draft(deal.id),
        email: {
          kind: "DRAFT",
          language: emailLanguage(deal.contractLanguage),
          url: appUrl(`/deals/${deal.id}`),
          dealName: deal.name,
          recipientName: partyName(initiator),
        },
      });
      if (outcome === "sent") ran++;
      if (outcome === "failed") errors++;
    } catch (err) {
      errors++;
      logger.error("draftReminders: failed on deal", { dealRoomId: deal.id, err: String(err) });
    }
  }
  return { ran, errors };
}

/**
 * Catch-up for "your contract is ready": agreed, unpaid deals whose parties
 * were not told yet (deals agreed by an express preset at creation, or a
 * send that failed). `notifyDealReady` skips anyone already told.
 */
export async function runReadySweepJob(): Promise<JobResult> {
  const start = billingStartDate();
  if (!start || !features.stripeEnabled) return { ran: 0, errors: 0 };
  let ran = 0;
  let errors = 0;

  const deals = await prisma.dealRoom.findMany({
    where: {
      status: "AGREED",
      createdAt: { gte: start },
      agentDealRoom: { is: null },
      payments: { none: { status: "PAID" } },
    },
    select: { id: true, _count: { select: { parties: true } }, notifications: { where: { kind: "READY" }, select: { id: true } } },
    take: 500,
  });

  for (const deal of deals) {
    if (deal.notifications.length >= deal._count.parties) continue;
    const r = await notifyDealReady(deal.id);
    ran += r.sent;
    errors += r.failed;
  }
  return { ran, errors };
}
