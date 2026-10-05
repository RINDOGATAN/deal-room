// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Transactional deal emails (owner decisions of 4 October 2026), the pure
 * rules: who receives which email, and when. No database, no sending; the
 * service in `src/server/services/notifications/deal-emails.ts` applies
 * these rules and records every email in `deal_notifications`.
 *
 * - "Your turn" (2a): when a party submits its clause choices or a
 *   counter-proposal, the other party is told it is now their turn. Once
 *   per submission, and once per round for counter-proposals (a party
 *   countering five clauses in one round sends one email, not five).
 * - Invitation reminders (2a): about day 3 and day 10 after an invitation
 *   that has not been accepted (invitations expire at 14 days). Each at
 *   most once per invitation; if the day-3 window was missed, only the
 *   day-10 reminder goes out.
 * - "Your contract is ready" (2a): when a deal becomes agreed and is not
 *   paid, to both parties, with the price in the recipient's currency and a
 *   direct link to "Get this contract". Once per party.
 * - Unfinished draft (2d): one email to the initiator two days after the
 *   last activity on a deal still in DRAFT, at most once per deal.
 *
 * Every email is about the person's own deal; none is marketing. None is
 * ever sent about a deal created before `CONTRACT_BILLING_START`, or when
 * that date is missing, and none about deals run by agents through the API.
 */

import { billingStartDate } from "@/lib/contract-billing";
import { currencyForCountry, parseCurrency, type Currency } from "@/lib/currency";

type Env = Record<string, string | undefined>;

export const DAY_MS = 86_400_000;

export type NotificationKind =
  | "TURN_SELECTIONS"
  | "TURN_COUNTER"
  | "INVITE_DAY3"
  | "INVITE_DAY10"
  | "READY"
  | "DRAFT";

/** Invitation reminder windows, in days after the invitation was sent. */
export const INVITE_DAY3 = 3;
export const INVITE_DAY10 = 10;

/** The draft reminder goes out from two days after the last activity... */
export const DRAFT_IDLE_DAYS = 2;
/** ...and not after seven, so a long-forgotten draft is left alone. */
export const DRAFT_STALE_DAYS = 7;

/**
 * Whether a deal may receive any of these emails: created on or after the
 * billing start (and the start is set), and not run by an agent.
 */
export function dealEmailsAllowed(
  deal: { createdAt: Date; isAgentDeal?: boolean },
  env: Env = process.env,
): boolean {
  if (deal.isAgentDeal) return false;
  const start = billingStartDate(env);
  if (!start) return false;
  return deal.createdAt.getTime() >= start.getTime();
}

/** The unique key recorded for each email; the same key is never sent twice. */
export const dedupeKeys = {
  turnSelections: (dealRoomId: string, fromPartyId: string, toPartyId: string) =>
    `turn-selections:${dealRoomId}:${fromPartyId}:${toPartyId}`,
  turnCounter: (roundId: string, fromPartyId: string, toPartyId: string) =>
    `turn-counter:${roundId}:${fromPartyId}:${toPartyId}`,
  invite: (kind: "INVITE_DAY3" | "INVITE_DAY10", invitationId: string) =>
    `${kind === "INVITE_DAY3" ? "invite-day3" : "invite-day10"}:${invitationId}`,
  ready: (dealRoomId: string, partyId: string) => `ready:${dealRoomId}:${partyId}`,
  draft: (dealRoomId: string) => `draft:${dealRoomId}`,
};

export interface PartyLike {
  id: string;
  role: "INITIATOR" | "RESPONDENT";
  userId: string | null;
  email: string | null;
  name: string | null;
  user?: { email: string | null; name: string | null } | null;
}

/** The address to write to: the account's, else the one the party was invited with. */
export function partyEmail(party: PartyLike): string | null {
  return party.user?.email?.trim() || party.email?.trim() || null;
}

/** A display name; never an email address (addresses are not names). */
export function partyName(party: PartyLike): string | null {
  const name = party.user?.name?.trim() || party.name?.trim() || "";
  return name && !name.includes("@") ? name : null;
}

/**
 * "Your turn": the party who must act after `fromPartyId` submitted. Only a
 * party that has joined the deal (has an account on it); a counterparty who
 * has not accepted the invitation gets the invitation reminders instead.
 */
export function turnRecipient(parties: PartyLike[], fromPartyId: string): PartyLike | null {
  const from = parties.find((p) => p.id === fromPartyId);
  if (!from) return null;
  const other = parties.find((p) => p.id !== fromPartyId);
  if (!other || !other.userId || !partyEmail(other)) return null;
  return other;
}

/** "Your contract is ready": every party with an address (one in solo mode, two otherwise). */
export function readyRecipients(parties: PartyLike[]): PartyLike[] {
  return parties.filter((p) => !!partyEmail(p));
}

/**
 * Whether a deal should receive "your contract is ready": agreed, not yet
 * paid, and payments are on. Signing and completed deals are past that point.
 */
export function readyEmailDue(deal: {
  status: string;
  paid: boolean;
  billingOn: boolean;
}): boolean {
  return deal.billingOn && deal.status === "AGREED" && !deal.paid;
}

/**
 * Which invitation reminder is due now, if any. Day 10 takes precedence
 * once reached, so a missed day-3 window never produces two emails on the
 * same run. Nothing after the invitation expires.
 */
export function inviteReminderDue(
  invitation: { status: string; sentAt: Date; expiresAt: Date },
  now: Date,
  alreadySent: ReadonlySet<NotificationKind>,
): "INVITE_DAY3" | "INVITE_DAY10" | null {
  if (invitation.status !== "PENDING") return null;
  const t = now.getTime();
  if (t >= invitation.expiresAt.getTime()) return null;
  const age = t - invitation.sentAt.getTime();
  if (age >= INVITE_DAY10 * DAY_MS) {
    return alreadySent.has("INVITE_DAY10") ? null : "INVITE_DAY10";
  }
  if (age >= INVITE_DAY3 * DAY_MS) {
    return alreadySent.has("INVITE_DAY3") ? null : "INVITE_DAY3";
  }
  return null;
}

/** The most recent of the given activity times (deal edits, selections, audit entries). */
export function lastActivity(times: Array<Date | null | undefined>): Date | null {
  let latest: Date | null = null;
  for (const t of times) {
    if (t && (!latest || t.getTime() > latest.getTime())) latest = t;
  }
  return latest;
}

/**
 * Whether the unfinished-draft reminder is due: the deal is still a draft,
 * the last activity was between two and seven days ago, and the reminder
 * has not been sent for this deal.
 */
export function draftReminderDue(
  deal: { status: string; lastActivityAt: Date },
  now: Date,
  alreadySent: boolean,
): boolean {
  if (alreadySent || deal.status !== "DRAFT") return false;
  const idle = now.getTime() - deal.lastActivityAt.getTime();
  return idle >= DRAFT_IDLE_DAYS * DAY_MS && idle < DRAFT_STALE_DAYS * DAY_MS;
}

/** The country whose currency stands for a jurisdiction when the person has no stored currency. */
const JURISDICTION_COUNTRY: Record<string, string> = {
  CALIFORNIA: "US",
  NEW_YORK: "US",
  ENGLAND_WALES: "GB",
  SPAIN: "ES",
};

/**
 * The recipient's currency for the "ready" email. A cron or another party's
 * request has no headers for this person, so: their stored billing currency
 * (`Customer.metadata.preferredCurrency`) when they have one, else the
 * currency of the deal's jurisdiction under the same one-currency-per-region
 * rule as the site (`currencyForCountry`: euros in Europe, dollars elsewhere).
 */
export function recipientCurrency(opts: { stored?: unknown; governingLaw: string }): Currency {
  return parseCurrency(opts.stored) ?? currencyForCountry(JURISDICTION_COUNTRY[opts.governingLaw] ?? null);
}

/** "en" or "es": the deal's contract language, the only language we know for both parties. */
export function emailLanguage(contractLanguage: string | null | undefined): "en" | "es" {
  return contractLanguage === "es" ? "es" : "en";
}
