// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Install-level AI posture gate + metadata-only generation audit.
 *
 * Dealroom variant of DPO Central's per-organization posture
 * (dpocentral-todo/src/server/services/ai/posture.ts): there is no
 * Organization model here, so the switch is the AiSettings singleton row
 * (id "singleton"), set by a PlatformAdmin.
 *
 * Truth table (requireAi):
 *   no AiSettings row                  -> PRECONDITION_FAILED "ai_off"
 *   posture "off"                      -> PRECONDITION_FAILED "ai_off"
 *   posture on, no engine configured   -> PRECONDITION_FAILED "ai_not_configured"
 *   posture on, engine configured      -> returns the settings row
 *
 * requireAi MUST run before any prompt building or door call — posture off
 * (or a missing row) means zero AI network calls, which keeps the "no AI
 * calls by default" promise true. The TRPCError message is a machine code
 * ("ai_off" | "ai_not_configured") the UI maps to i18n strings.
 *
 * AiGeneration stores who/when/feature/model/tokens/duration only — never
 * prompt or output text — and doubles as the install-wide hourly rate limiter.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { TRPCError } from "@trpc/server";
import type { AiSettings, AiGeneration, AiPosture } from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { isAIConfigured, type AiLane } from "./llm-door";

/** Hosted metered-key cap: generations per install per hour. */
export const AI_RATE_LIMIT_PER_HOUR = 30;

/** The one AiSettings row (Dealroom has no Organization model). */
export const AI_SETTINGS_SINGLETON_ID = "singleton";

// The subset of the (extended) client these helpers touch — unit tests pass a mock.
type PrismaLike = Pick<ExtendedPrismaClient, "aiSettings" | "aiGeneration">;

/**
 * An AiSettings row whose posture is known to be an actual lane (not "off").
 * requireAi only ever returns this shape, so callers can pass
 * `settings.posture` straight to the door as `lane` (posture-routed lanes:
 * the acknowledged posture and the physical traffic lane are the same fact).
 */
export type ActiveAiSettings = AiSettings & { posture: AiLane };

/**
 * Gate an AI feature on the install's posture AND engine availability
 * FOR THAT POSTURE'S LANE (a lane-suffixed gateway triple, falling back to
 * the base one — see llm-door laneEnv). Throws PRECONDITION_FAILED
 * ("ai_off" | "ai_not_configured") when the feature must not run; returns
 * the settings row when generation may proceed.
 */
export async function requireAi(prisma: PrismaLike): Promise<ActiveAiSettings> {
  const settings = await prisma.aiSettings.findUnique({
    where: { id: AI_SETTINGS_SINGLETON_ID },
  });

  if (!settings || settings.posture === "off") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ai_off" });
  }

  // The off-case threw above, so the posture IS a lane.
  const lane: AiLane = settings.posture;

  if (!isAIConfigured(lane)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ai_not_configured" });
  }

  return settings as ActiveAiSettings;
}

/**
 * Reject when the install already burned its hourly generation budget.
 * Counts AiGeneration rows (any status) in the last hour.
 */
export async function assertAiRateLimit(prisma: PrismaLike): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.aiGeneration.count({
    where: { createdAt: { gte: oneHourAgo } },
  });

  if (recent >= AI_RATE_LIMIT_PER_HOUR) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "ai_rate_limited",
    });
  }
}

export interface RecordGenerationInput {
  dealRoomId?: string | null;
  userId?: string | null;
  feature: "compromise_reasoning" | "risk_digest";
  entityType?: string | null;
  entityId?: string | null;
  model?: string | null;
  posture: AiPosture;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  durationMs?: number | null;
  status: "ok" | "error";
  /**
   * Dealroom's grounded features persist the AI text server-side at the
   * user's explicit request, so acceptance is stamped at creation time
   * (there is no separate Insert step for them).
   */
  acceptedAt?: Date | null;
}

/** Append one metadata-only audit row (no prompt/output text, ever). */
export async function recordGeneration(
  prisma: PrismaLike,
  input: RecordGenerationInput
): Promise<AiGeneration> {
  return prisma.aiGeneration.create({
    data: {
      dealRoomId: input.dealRoomId ?? null,
      userId: input.userId ?? null,
      feature: input.feature,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      model: input.model ?? null,
      posture: input.posture,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      totalTokens: input.totalTokens ?? null,
      durationMs: input.durationMs ?? null,
      status: input.status,
      acceptedAt: input.acceptedAt ?? null,
    },
  });
}

/**
 * Stamp acceptedAt when the user Inserts a draft (scoped to the requesting
 * user so nobody can stamp someone else's rows). Returns true when a row
 * was updated.
 */
export async function markAccepted(
  prisma: PrismaLike,
  userId: string,
  generationId: string
): Promise<boolean> {
  const result = await prisma.aiGeneration.updateMany({
    where: { id: generationId, userId },
    data: { acceptedAt: new Date() },
  });
  return result.count > 0;
}
