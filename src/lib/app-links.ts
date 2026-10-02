// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Rules for the dashboard's header and footer links. Every link there must
 * land on a working page in the posture where it shows
 * (`src/lib/__tests__/app-links.test.ts` checks each one).
 */

/**
 * The requests inbox (/lawyers/requests) means nothing to most people, so
 * its footer link shows only once the person has sent or received at least
 * one request (`lawyer.myRequestCount`). Unknown (still loading) = hidden.
 */
export function shouldShowRequestsLink(count: number | null | undefined): boolean {
  return typeof count === "number" && count > 0;
}
