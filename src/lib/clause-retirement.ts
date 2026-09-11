// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Retired clauses and options.
 *
 * When a built-in skill stops offering a clause or an option, the seed removes
 * the row if nothing uses it and otherwise retires it — sets `retiredAt` and
 * keeps it, because existing deals reference it (see prisma/skill-reconcile.ts).
 *
 * Two rules follow, and these helpers carry them:
 *   - a new deal, and every catalog or playbook view of what a skill offers,
 *     sees live rows only;
 *   - a deal that already uses a retired option keeps being offered it, so its
 *     selections, its agreed text and its document stay intact.
 *
 * Queries that only render an existing contract (the PDF generator, the signing
 * bundle) filter nothing: a signed deal must render in full.
 */

import type { Prisma } from "@prisma/client";

/** Clauses and options a skill currently offers. */
export const LIVE_ROWS = { retiredAt: null } as const;

/**
 * Options this deal may be shown: everything still offered, plus any retired
 * option the deal itself already selected, was suggested, or countered with.
 */
export function offerableOptionsWhere(dealRoomId: string): Prisma.ClauseOptionWhereInput {
  return {
    OR: [
      { retiredAt: null },
      { partySelections: { some: { dealRoomClause: { dealRoomId } } } },
      { compromiseSuggestions: { some: { dealRoomClause: { dealRoomId } } } },
      { counterProposals: { some: { dealRoomClause: { dealRoomId } } } },
    ],
  };
}
