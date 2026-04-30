/**
 * Auto-agree helper for deals whose clauses have no real choice.
 *
 * When a clause template offers exactly one option ("Use X as entered"),
 * making the user click through it is ceremony with zero value. This helper
 * auto-creates a PartySelection for every such clause. If EVERY clause is
 * single-option AND the deal is SOLO mode, it also submits the party,
 * agrees every clause, and flips the deal to AGREED — so the PDF is
 * downloadable immediately.
 *
 * Shared by `deal.create` and `journey.generateStep` to keep behavior
 * consistent regardless of how the deal was created.
 */

import { DealMode, PartyStatus, ClauseStatus, DealRoomStatus } from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/prisma";

type Prisma = ExtendedPrismaClient | Omit<ExtendedPrismaClient, `$${string}`>;

export async function autoAgreeSingleOptionClauses(
  prisma: Prisma,
  opts: {
    dealRoomId: string;
    dealMode: DealMode;
    partyId: string;
    templateClauses: Array<{ id: string; options: Array<{ id: string }> }>;
    dealClauses: Array<{ id: string; clauseTemplateId: string }>;
  },
): Promise<{ autoAgreed: boolean; singleOptionCount: number }> {
  const singleOption = opts.templateClauses.filter((c) => c.options.length === 1);
  if (singleOption.length === 0) {
    return { autoAgreed: false, singleOptionCount: 0 };
  }

  // Create a selection for each single-option clause. priority and
  // flexibility default to 3 in the schema and are unused in SOLO
  // mode — letting the default fire keeps the auto-agree path from
  // pretending the user expressed a firmness preference.
  for (const ct of singleOption) {
    const dealClause = opts.dealClauses.find((c) => c.clauseTemplateId === ct.id);
    if (!dealClause) continue;
    await prisma.partySelection.create({
      data: {
        dealRoomClauseId: dealClause.id,
        partyId: opts.partyId,
        optionId: ct.options[0].id,
      },
    });
  }

  const everyClauseIsSingleOption =
    singleOption.length === opts.templateClauses.length;
  const canAutoAgree = everyClauseIsSingleOption && opts.dealMode === DealMode.SOLO;

  if (canAutoAgree) {
    await prisma.dealRoomParty.update({
      where: { id: opts.partyId },
      data: { status: PartyStatus.SUBMITTED, submittedAt: new Date() },
    });
    for (const dealClause of opts.dealClauses) {
      const ct = opts.templateClauses.find((c) => c.id === dealClause.clauseTemplateId);
      if (!ct) continue;
      await prisma.dealRoomClause.update({
        where: { id: dealClause.id },
        data: { status: ClauseStatus.AGREED, agreedOptionId: ct.options[0].id },
      });
    }
    await prisma.dealRoom.update({
      where: { id: opts.dealRoomId },
      data: { status: DealRoomStatus.AGREED },
    });
  }

  return { autoAgreed: canAutoAgree, singleOptionCount: singleOption.length };
}
