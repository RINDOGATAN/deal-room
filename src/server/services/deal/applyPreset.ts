// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Express-setup presets.
 *
 * A skill can ship a `presets.json` mapping every clause to one option
 * (plus optional parameter overrides). Applying a preset creates the
 * initiator's PartySelection for every mapped clause. In SOLO mode the
 * party is submitted, every clause AGREED and the deal flipped to AGREED —
 * the document is ready without walking the wizard. In NEGOTIATION mode
 * the selections stay as a pre-filled starting point the initiator can
 * still adjust before submitting.
 *
 * Preset `selections` use skill-level ids (clauseId → optionId as authored
 * in clauses.json), not DB cuids, so presets survive reseeds.
 */

import { DealMode, PartyStatus, ClauseStatus, DealRoomStatus } from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/prisma";

type Prisma = ExtendedPrismaClient | Omit<ExtendedPrismaClient, `$${string}`>;

export interface TemplatePreset {
  id: string;
  name: Record<string, string> | string;
  description?: Record<string, string> | string;
  selections: Record<string, string>;
  parameters?: Record<string, string>;
}

export function findPreset(presets: unknown, presetId: string): TemplatePreset | null {
  if (!Array.isArray(presets)) return null;
  const preset = presets.find(
    (p): p is TemplatePreset =>
      !!p && typeof p === "object" && (p as TemplatePreset).id === presetId
  );
  return preset && preset.selections && typeof preset.selections === "object"
    ? preset
    : null;
}

export async function applyPresetSelections(
  prisma: Prisma,
  opts: {
    dealRoomId: string;
    dealMode: DealMode;
    partyId: string;
    preset: TemplatePreset;
    templateClauses: Array<{
      id: string;
      clauseId: string;
      options: Array<{ id: string; optionId: string }>;
    }>;
    dealClauses: Array<{ id: string; clauseTemplateId: string }>;
  },
): Promise<{ agreed: boolean; unresolvedClauseIds: string[] }> {
  // Resolve each template clause to the option the preset names. Clauses the
  // preset omits fall back to their only option when there is exactly one.
  const resolved: Array<{ dealClauseId: string; optionDbId: string }> = [];
  const unresolved: string[] = [];

  for (const ct of opts.templateClauses) {
    const dealClause = opts.dealClauses.find((c) => c.clauseTemplateId === ct.id);
    if (!dealClause) continue;

    const wantedOptionId = opts.preset.selections[ct.clauseId];
    let option = wantedOptionId
      ? ct.options.find((o) => o.optionId === wantedOptionId)
      : undefined;
    if (!option && !wantedOptionId && ct.options.length === 1) {
      option = ct.options[0];
    }

    if (option) {
      resolved.push({ dealClauseId: dealClause.id, optionDbId: option.id });
    } else {
      unresolved.push(ct.clauseId);
    }
  }

  for (const r of resolved) {
    await prisma.partySelection.create({
      data: {
        dealRoomClauseId: r.dealClauseId,
        partyId: opts.partyId,
        optionId: r.optionDbId,
      },
    });
  }

  // Only a fully-resolved SOLO deal can jump straight to AGREED.
  const canAgree = opts.dealMode === DealMode.SOLO && unresolved.length === 0;
  if (canAgree) {
    await prisma.dealRoomParty.update({
      where: { id: opts.partyId },
      data: { status: PartyStatus.SUBMITTED, submittedAt: new Date() },
    });
    for (const r of resolved) {
      await prisma.dealRoomClause.update({
        where: { id: r.dealClauseId },
        data: { status: ClauseStatus.AGREED, agreedOptionId: r.optionDbId },
      });
    }
    await prisma.dealRoom.update({
      where: { id: opts.dealRoomId },
      data: { status: DealRoomStatus.AGREED },
    });
  }

  return { agreed: canAgree, unresolvedClauseIds: unresolved };
}
