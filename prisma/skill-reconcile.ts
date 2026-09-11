// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Removes clause and option rows that a skill no longer contains.
 *
 * The seed upserts by stable identifiers (contractType, clauseId, optionId),
 * which adds and updates rows but never removes them. Without this pass, a
 * clause dropped from a skill keeps being attached to every new deal, and a
 * renamed option is offered twice (old id and new id). That is how the hosted
 * DPA once asked the same questions twice (2026-06, cleaned up by hand).
 *
 * A stale row is handled in one of two ways:
 *   - nothing references it -> deleted (a clause's options go with it);
 *   - an existing deal references it -> retired (`retiredAt` set). The row is
 *     kept, so that deal keeps its clause and its agreed text, but new deals
 *     no longer receive it and option pickers offer it only to the deals that
 *     already use it (see src/lib/clause-retirement.ts).
 * A row that reappears in the skill is revived by the seed's upsert, which
 * clears `retiredAt`.
 *
 * A rename is therefore a removal plus an addition: deals made before it keep
 * the wording they negotiated, new deals get the new one.
 *
 * Scope is the caller's decision. The seed calls this ONLY for built-in skills
 * (repo `skills/`) whose template is not linked to a skill package, so premium
 * and firm-installed skills are never touched by the refresh.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

type Client = PrismaClient | Prisma.TransactionClient;

export interface SkillShape {
  clauses: { id: string; options: { id: string }[] }[];
}

export interface ReconcileResult {
  deletedClauses: string[];
  retiredClauses: string[];
  deletedOptions: string[];
  retiredOptions: string[];
}

export interface ReconcileOptions {
  /** Report what would change without writing anything. */
  dryRun?: boolean;
  now?: Date;
}

// Prisma's foreign-key violation. A deal created between our reference check
// and the delete (hosted seeds run against a live app) makes the delete fail;
// the row is then retired instead.
function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2003"
  );
}

export async function reconcileSkillClauses(
  prisma: Client,
  contractTemplateId: string,
  skill: SkillShape,
  opts: ReconcileOptions = {}
): Promise<ReconcileResult> {
  const now = opts.now ?? new Date();
  const result: ReconcileResult = {
    deletedClauses: [],
    retiredClauses: [],
    deletedOptions: [],
    retiredOptions: [],
  };

  const wantedOptions = new Map<string, Set<string>>();
  for (const clause of skill.clauses) {
    wantedOptions.set(clause.id, new Set(clause.options.map((o) => o.id)));
  }

  const rows = await prisma.clauseTemplate.findMany({
    where: { contractTemplateId },
    select: {
      id: true,
      clauseId: true,
      retiredAt: true,
      _count: { select: { dealRoomClauses: true, lawyerRecommendations: true } },
      options: {
        select: {
          id: true,
          optionId: true,
          retiredAt: true,
          _count: {
            select: {
              partySelections: true,
              compromiseSuggestions: true,
              counterProposals: true,
              lawyerRecommendations: true,
            },
          },
        },
      },
    },
  });

  // DealRoomClause.agreedOptionId is a plain string, not a foreign key, so it
  // is checked separately. In practice an agreed option is also a selection or
  // a suggestion, but a missed reference here would drop agreed text.
  const allOptionIds = rows.flatMap((r) => r.options.map((o) => o.id));
  const agreed = new Set(
    allOptionIds.length === 0
      ? []
      : (
          await prisma.dealRoomClause.findMany({
            where: { agreedOptionId: { in: allOptionIds } },
            select: { agreedOptionId: true },
          })
        ).map((r) => r.agreedOptionId as string)
  );

  type OptionRow = (typeof rows)[number]["options"][number];
  const optionInUse = (o: OptionRow) =>
    agreed.has(o.id) ||
    o._count.partySelections +
      o._count.compromiseSuggestions +
      o._count.counterProposals +
      o._count.lawyerRecommendations >
      0;

  for (const clause of rows) {
    const wanted = wantedOptions.get(clause.clauseId);

    if (!wanted) {
      const inUse =
        clause._count.dealRoomClauses + clause._count.lawyerRecommendations > 0 ||
        clause.options.some(optionInUse);
      if (!inUse && (await remove(prisma, "clause", clause.id, opts))) {
        result.deletedClauses.push(clause.clauseId);
      } else if (!clause.retiredAt) {
        if (!opts.dryRun) {
          await prisma.clauseTemplate.update({
            where: { id: clause.id },
            data: { retiredAt: now },
          });
        }
        result.retiredClauses.push(clause.clauseId);
      }
      // A retired clause keeps its options as they are: the deals that still
      // carry the clause keep seeing the choices they had.
      continue;
    }

    for (const option of clause.options) {
      if (wanted.has(option.optionId)) continue;
      const label = `${clause.clauseId}/${option.optionId}`;
      if (!optionInUse(option) && (await remove(prisma, "option", option.id, opts))) {
        result.deletedOptions.push(label);
      } else if (!option.retiredAt) {
        if (!opts.dryRun) {
          await prisma.clauseOption.update({
            where: { id: option.id },
            data: { retiredAt: now },
          });
        }
        result.retiredOptions.push(label);
      }
    }
  }

  return result;
}

// Deletes one row; returns false (so the caller retires it) when a reference
// appeared since the check.
async function remove(
  prisma: Client,
  kind: "clause" | "option",
  id: string,
  opts: ReconcileOptions
): Promise<boolean> {
  if (opts.dryRun) return true;
  try {
    if (kind === "clause") {
      await prisma.clauseTemplate.delete({ where: { id } });
    } else {
      await prisma.clauseOption.delete({ where: { id } });
    }
    return true;
  } catch (error) {
    if (isForeignKeyViolation(error)) return false;
    throw error;
  }
}

export function describeReconcile(r: ReconcileResult): string[] {
  const lines: string[] = [];
  if (r.deletedClauses.length) lines.push(`removed unused clauses: ${r.deletedClauses.join(", ")}`);
  if (r.retiredClauses.length) lines.push(`retired clauses still used by existing deals: ${r.retiredClauses.join(", ")}`);
  if (r.deletedOptions.length) lines.push(`removed unused options: ${r.deletedOptions.join(", ")}`);
  if (r.retiredOptions.length) lines.push(`retired options still used by existing deals: ${r.retiredOptions.join(", ")}`);
  return lines;
}
