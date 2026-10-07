// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { requestJointCounsel } from "@/server/services/attorney/jointCounsel";

export const jointCounselRouter = createTRPCRouter({
  /**
   * Request joint closing counsel (Stage B) by naming a lawyer by e-mail
   * (owner's decision, 6 October 2026). Only the INITIATOR may request,
   * once per deal; the other party then acknowledges or declines. There is
   * no list of lawyers to choose from and no supervisor id is accepted.
   */
  request: protectedProcedure
    .input(
      z.object({
        dealRoomId: z.string(),
        email: z.string().trim().email().max(254),
        name: z.string().trim().max(120).optional(),
        lang: z.enum(["en", "es"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: { dealRoomId: input.dealRoomId, userId: ctx.session.user.id },
        select: { id: true },
      });
      if (!party) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a party to this deal" });
      }
      const result = await requestJointCounsel(ctx.prisma, {
        partyId: party.id,
        lawyerEmail: input.email,
        lawyerName: input.name,
        actorUserId: ctx.session.user.id,
        lang: input.lang,
      });
      if (!result.ok) {
        const code =
          result.status === 404 ? "NOT_FOUND"
          : result.status === 403 ? "FORBIDDEN"
          : result.status === 409 ? "CONFLICT"
          : "BAD_REQUEST";
        throw new TRPCError({ code, message: result.error });
      }
      return { success: true, emailSent: result.emailSent };
    }),

  /**
   * Acknowledge the joint counsel request.
   * Only the OTHER party (not the one who requested) may acknowledge.
   */
  acknowledge: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: {
          dealRoomId: input.dealRoomId,
          userId: ctx.session.user.id,
        },
        include: {
          dealRoom: true,
        },
      });

      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a party to this deal",
        });
      }

      if (!party.dealRoom.jointCounselRequestedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No joint counsel request exists for this deal",
        });
      }

      // Caller must NOT be the party who requested
      if (party.dealRoom.jointCounselRequestedBy === party.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot acknowledge your own joint counsel request",
        });
      }

      if (party.dealRoom.jointCounselAcknowledgedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Joint counsel request has already been acknowledged",
        });
      }

      if (party.dealRoom.jointCounselDeclinedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Joint counsel request has already been declined",
        });
      }

      await ctx.prisma.$transaction([
        ctx.prisma.dealRoom.update({
          where: { id: input.dealRoomId },
          data: {
            jointCounselAcknowledgedAt: new Date(),
          },
        }),
        ctx.prisma.auditLog.create({
          data: {
            dealRoomId: input.dealRoomId,
            userId: ctx.session.user.id,
            action: "JOINT_COUNSEL_ACKNOWLEDGED",
            details: {
              partyId: party.id,
              partyRole: party.role,
            },
          },
        }),
      ]);

      return { success: true };
    }),

  /**
   * Decline the joint counsel request.
   * Only the OTHER party (not the one who requested) may decline.
   * Clears the supervisor and removes the party-initiated assignment.
   */
  decline: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: {
          dealRoomId: input.dealRoomId,
          userId: ctx.session.user.id,
        },
        include: {
          dealRoom: true,
        },
      });

      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a party to this deal",
        });
      }

      if (!party.dealRoom.jointCounselRequestedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No joint counsel request exists for this deal",
        });
      }

      // Caller must NOT be the party who requested
      if (party.dealRoom.jointCounselRequestedBy === party.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot decline your own joint counsel request",
        });
      }

      if (party.dealRoom.jointCounselAcknowledgedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Joint counsel request has already been acknowledged",
        });
      }

      if (party.dealRoom.jointCounselDeclinedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Joint counsel request has already been declined",
        });
      }

      const supervisorId = party.dealRoom.jointCounselSupervisorId;

      const operations: Prisma.PrismaPromise<unknown>[] = [
        // Set declined timestamp and clear supervisor
        ctx.prisma.dealRoom.update({
          where: { id: input.dealRoomId },
          data: {
            jointCounselDeclinedAt: new Date(),
            jointCounselSupervisorId: null,
          },
        }),
        // Audit log
        ctx.prisma.auditLog.create({
          data: {
            dealRoomId: input.dealRoomId,
            userId: ctx.session.user.id,
            action: "JOINT_COUNSEL_DECLINED",
            details: {
              partyId: party.id,
              partyRole: party.role,
              supervisorId,
            },
          },
        }),
      ];

      // Remove supervisor assignment only if it was party-initiated (assignedBy is null)
      if (supervisorId) {
        operations.push(
          ctx.prisma.supervisorAssignment.deleteMany({
            where: {
              supervisorId,
              dealRoomId: input.dealRoomId,
              assignedBy: null,
            },
          })
        );
      }

      await ctx.prisma.$transaction(operations);

      return { success: true };
    }),

  /**
   * Get the current joint counsel status for a deal.
   * Any party may call this.
   */
  getStatus: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .query(async ({ ctx, input }) => {
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: {
          dealRoomId: input.dealRoomId,
          userId: ctx.session.user.id,
        },
        include: {
          dealRoom: {
            include: {
              jointCounselSupervisor: {
                select: { id: true, name: true, email: true },
              },
              parties: true,
            },
          },
        },
      });

      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a party to this deal",
        });
      }

      const dealRoom = party.dealRoom;
      const isInitiator = party.role === "INITIATOR";

      // Waiver text depends on whether the calling party used Stage A
      const waiverText = party.attorneyReviewRequested
        ? "I had separate counsel review my position and consent to joint closing counsel."
        : "I declined separate counsel and consent to joint closing counsel.";

      return {
        requested: !!dealRoom.jointCounselRequestedAt,
        supervisorName:
          dealRoom.jointCounselSupervisor?.name ||
          dealRoom.jointCounselSupervisor?.email ||
          null,
        supervisorEmail: dealRoom.jointCounselSupervisor?.email || null,
        requestedAt: dealRoom.jointCounselRequestedAt || null,
        requestedBy: dealRoom.jointCounselRequestedBy || null,
        acknowledgedAt: dealRoom.jointCounselAcknowledgedAt || null,
        declinedAt: dealRoom.jointCounselDeclinedAt || null,
        isInitiator,
        waiverText,
      };
    }),
});
