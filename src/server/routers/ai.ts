// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * AI posture + audit router (Dealroom variant of DPO Central's ai router).
 *
 * Dealroom has no Organization model, so the switch for the optional
 * embedded-AI assists is INSTALL-LEVEL: the AiSettings singleton row, set
 * only by a PlatformAdmin. Default posture is OFF (no row = off): the app
 * makes zero AI calls until an admin explicitly enables a posture AND
 * acknowledges the responsibility sentence (acknowledged: z.literal(true) —
 * recorded as acknowledgedByAdminId/At). Feature procedures live in their
 * domain routers (compromise.generateAiReasoning, signing.generateRiskDigest)
 * and gate through services/ai/posture.ts requireAi.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "../trpc";
import { getAIProviderName, isAIConfigured } from "../services/ai/llm-door";
import {
  AI_RATE_LIMIT_PER_HOUR,
  AI_SETTINGS_SINGLETON_ID,
  markAccepted,
} from "../services/ai/posture";

export const AI_POSTURES = ["off", "local_gateway", "cloud_eu", "cloud_us"] as const;

// getStatus must be readable by every authenticated audience (deal parties,
// supervisors, and platform admins — the posture card runs in the admin
// area, which has its own session cookie), so it accepts any of the three
// session kinds rather than only a next-auth user session.
const anySessionProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user && !ctx.adminSession && !ctx.supervisorSession) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next();
});

export const aiRouter = createTRPCRouter({
  // Posture + engine status for this install (any authenticated audience).
  getStatus: anySessionProcedure.query(async ({ ctx }) => {
    const settings = await ctx.prisma.aiSettings.findUnique({
      where: { id: AI_SETTINGS_SINGLETON_ID },
      include: {
        acknowledgedByAdmin: { select: { id: true, name: true, email: true } },
      },
    });

    const posture = settings?.posture ?? "off";
    const configured = isAIConfigured();

    return {
      posture,
      configured,
      providerName: configured ? getAIProviderName() : null,
      acknowledgedAt: settings?.acknowledgedAt ?? null,
      acknowledgedBy: settings?.acknowledgedByAdmin ?? null,
      // Generation can actually run only when both are true.
      active: posture !== "off" && configured,
      rateLimitPerHour: AI_RATE_LIMIT_PER_HOUR,
    };
  }),

  // Set the install's AI posture (platform admin only). The acknowledgment
  // checkbox is not optional — the input requires a literal true.
  setPosture: adminProcedure
    .input(
      z.object({
        posture: z.enum(AI_POSTURES),
        acknowledged: z.literal(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const settings = await ctx.prisma.aiSettings.upsert({
        where: { id: AI_SETTINGS_SINGLETON_ID },
        create: {
          id: AI_SETTINGS_SINGLETON_ID,
          posture: input.posture,
          acknowledgedByAdminId: ctx.adminSession.adminId,
          acknowledgedAt: now,
        },
        update: {
          posture: input.posture,
          acknowledgedByAdminId: ctx.adminSession.adminId,
          acknowledgedAt: now,
        },
      });

      // Platform admins are not Users, so userId stays null; the admin is
      // identified in the details payload instead.
      await ctx.prisma.auditLog.create({
        data: {
          action: "AI_POSTURE_CHANGED",
          details: {
            posture: input.posture,
            acknowledged: true,
            adminId: ctx.adminSession.adminId,
            adminEmail: ctx.adminSession.email,
          },
        },
      });

      return settings;
    }),

  // Metadata-only generation audit (who/when/feature/model/tokens — no text).
  listGenerations: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.aiGeneration.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          dealRoom: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  // Stamp acceptedAt on a generation when the user Inserts a draft
  // (AiDraftPanel insert mode; scoped to the caller's own generations).
  markAccepted: protectedProcedure
    .input(z.object({ generationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await markAccepted(
        ctx.prisma,
        ctx.session.user.id,
        input.generationId
      );
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Generation not found" });
      }
      return { ok: true };
    }),
});
