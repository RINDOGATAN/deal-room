// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Hosted pilot rules (owner decision 2026-09-16).
 *
 * The hosted service (dealroom.todo.law) is a free, capped pilot: every
 * contract skill is available to every account without an entitlement, and
 * nothing is sold there. Premium skills are sold only for the self-hosted
 * kit, activated offline by licence file, with no caps. This module holds
 * the pure rules; `src/server/services/pilot.ts` applies them to the
 * database and `src/config/features.ts` exposes the posture flag.
 *
 * Dealroom has no organisation table: each account (User row) is its own,
 * single organisation. "One organisation per account" therefore holds by
 * construction, and every pilot cap below is counted per account.
 */

type Env = Record<string, string | undefined>;

/**
 * Whether this build runs as the hosted pilot. Uses the same signal as the
 * auth guards (`auth-provider-policy.ts`): Vercel production. The hosted
 * cookie domain counts too, but only when set explicitly: the implicit
 * `.todo.law` fallback in `auth.ts` applies to any production build without
 * `AUTH_COOKIE_DOMAIN`, and a kit must never be capped by accident.
 * `NEXT_PUBLIC_HOSTED_PILOT` is the build-time copy of this answer that
 * `next.config.ts` inlines for the browser bundle.
 */
export function isHostedPilotEnv(env: Env): boolean {
  if (env.NEXT_PUBLIC_HOSTED_PILOT === "true") return true;
  if (env.VERCEL_ENV === "production") return true;
  const domain = env.AUTH_COOKIE_DOMAIN?.trim().toLowerCase();
  return !!domain && (domain === ".todo.law" || domain === "todo.law");
}

export const PILOT_CAPS = {
  /** No organisation model: one account is one organisation. */
  organisationsPerAccount: 1,
  /** Days of editing from the account's first pilot sign-in. */
  editDays: 90,
  /** Deals an account may start (as initiator). Invited deals do not count. */
  deals: 10,
  /** Guided startup journeys an account may start. */
  journeys: 3,
} as const;

export type PilotRecordKind = "deals" | "journeys";

/** Where a pilot user goes to run an uncapped instance. */
export const PILOT_RUN_URL = "https://www.todo.law/run";
/** Full export of everything the account created (always allowed). */
export const PILOT_EXPORT_PATH = "/api/account/export";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PilotEditWindow {
  /** Whole days of editing left (0 once the window has closed). */
  daysLeft: number;
  readOnly: boolean;
  endsAt: Date;
}

/** The 90-day edit window that starts at the account's first sign-in. */
export function pilotEditWindow(startedAt: Date, now: Date = new Date()): PilotEditWindow {
  const endsAt = new Date(startedAt.getTime() + PILOT_CAPS.editDays * DAY_MS);
  const remainingMs = endsAt.getTime() - now.getTime();
  return {
    daysLeft: remainingMs > 0 ? Math.ceil(remainingMs / DAY_MS) : 0,
    readOnly: remainingMs <= 0,
    endsAt,
  };
}

/** Whether `adding` more records of a kind still fit under the ceiling. */
export function pilotHasRoom(kind: PilotRecordKind, used: number, adding = 1): boolean {
  return used + adding <= PILOT_CAPS[kind];
}

/**
 * tRPC mutations that stay open after the edit window closes. Everything
 * else is refused, so the account is read-only; reads and the export
 * (plain GET routes) are never affected.
 */
const READ_ONLY_ALLOWED_MUTATIONS = new Set<string>([
  // Telling us about a problem is not editing the account's records.
  "feedback.submit",
  // The onboarding modal cannot be closed without a role; refusing this
  // would lock a read-only account out of reading its own deals.
  "lawyer.setRole",
]);

/** Mutations that never need the edit-window check. */
export function pilotMutationExempt(path: string): boolean {
  return READ_ONLY_ALLOWED_MUTATIONS.has(path);
}

export function pilotAllowsMutation(path: string, readOnly: boolean): boolean {
  return !readOnly || pilotMutationExempt(path);
}

export type PilotCapReason = "read_only" | PilotRecordKind;

/**
 * English server message for a reached cap. It names both ways out; the
 * interface shows the translated version (`pilot.*` messages).
 */
export function pilotCapMessage(reason: PilotCapReason): string {
  const what =
    reason === "read_only"
      ? `The ${PILOT_CAPS.editDays}-day hosted pilot has ended, so this account is now read-only.`
      : `This account has reached the hosted pilot limit of ${PILOT_CAPS[reason]} ${reason === "deals" ? "deals" : "startup journeys"}.`;
  return `${what} To keep working, run your own instance (${PILOT_RUN_URL}) or export what you created (${PILOT_EXPORT_PATH}).`;
}
