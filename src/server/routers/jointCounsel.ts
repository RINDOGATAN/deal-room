// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  sendJointCounselAssignmentEmail,
  sendJointCounselNotificationEmail,
} from "@/lib/email";
import { createLogger } from "@/lib/logger";

const logger = createLogger("joint-counsel");

export const jointCounselRouter = createTRPCRouter({
  /**
   * List available supervisors for joint closing counsel (Stage B).
   * Only the INITIATOR can browse this list.
   * Supervisors must have bar admission matching the deal's governing law
   * and must NOT already be a Stage A attorney for either party.
   */
  listAvailable: protectedProcedure
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

      if (party.dealRoom.status !== "AGREED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deal must be in AGREED status to request joint counsel",
        });
      }

      if (party.role !== "INITIATOR") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the initiator can request joint closing counsel",
        });
      }

      // Collect Stage A attorney IDs from both parties to exclude
      const stageAAttorneyIds = party.dealRoom.parties
        .map((p) => p.attorneySupervisorId)
        .filter((id): id is string => id !== null);

      // Find active supervisors with bar admission for this jurisdiction
      const supervisors = await ctx.prisma.supervisor.findMany({
        where: {
          isActive: true,
          id: { notIn: stageAAttorneyIds },
          barAdmissions: {
            some: {
              jurisdiction: party.dealRoom.governingLaw,
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          barAdmissions: {
            where: {
              jurisdiction: party.dealRoom.governingLaw,
            },
            select: {
              barNumber: true,
            },
          },
        },
      });

      return supervisors.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        barNumber: s.barAdmissions[0]?.barNumber ?? null,
      }));
    }),

  /**
   * Request a joint closing counsel supervisor for the deal.
   * Only the INITIATOR may request, and the deal must not already have one.
   */
  request: protectedProcedure
    .input(
      z.object({
        dealRoomId: z.string(),
        supervisorId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: {
          dealRoomId: input.dealRoomId,
          userId: ctx.session.user.id,
        },
        include: {
          dealRoom: {
            include: {
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

      if (party.dealRoom.status !== "AGREED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deal must be in AGREED status",
        });
      }

      if (party.role !== "INITIATOR") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the initiator can request joint closing counsel",
        });
      }

      if (party.dealRoom.jointCounselSupervisorId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Joint closing counsel has already been requested for this deal",
        });
      }

      // Verify supervisor is active and has bar admission for this jurisdiction
      const supervisor = await ctx.prisma.supervisor.findUnique({
        where: { id: input.supervisorId },
        include: {
          barAdmissions: {
            where: {
              jurisdiction: party.dealRoom.governingLaw,
            },
          },
        },
      });

      if (!supervisor || !supervisor.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected supervisor is not available",
        });
      }

      if (supervisor.barAdmissions.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Selected supervisor is not admitted to practice in this jurisdiction",
        });
      }

      const otherParty = party.dealRoom.parties.find(
        (p) => p.id !== party.id
      );

      await ctx.prisma.$transaction([
        // Update DealRoom with joint counsel fields
        ctx.prisma.dealRoom.update({
          where: { id: input.dealRoomId },
          data: {
            jointCounselSupervisorId: input.supervisorId,
            jointCounselRequestedAt: new Date(),
            jointCounselRequestedBy: party.id,
          },
        }),
        // Upsert supervisor assignment so they can see the deal
        ctx.prisma.supervisorAssignment.upsert({
          where: {
            supervisorId_dealRoomId: {
              supervisorId: input.supervisorId,
              dealRoomId: input.dealRoomId,
            },
          },
          update: {},
          create: {
            supervisorId: input.supervisorId,
            dealRoomId: input.dealRoomId,
            assignedBy: null, // Party-initiated, not admin-assigned
          },
        }),
        // Audit log
        ctx.prisma.auditLog.create({
          data: {
            dealRoomId: input.dealRoomId,
            userId: ctx.session.user.id,
            action: "JOINT_COUNSEL_REQUESTED",
            details: {
              supervisorId: input.supervisorId,
              supervisorName: supervisor.name,
              supervisorEmail: supervisor.email,
              partyRole: party.role,
            },
          },
        }),
      ]);

      // Fire-and-forget: notify the supervisor
      sendJointCounselAssignmentEmail({
        to: supervisor.email,
        supervisorName: supervisor.name || supervisor.email,
        dealName: party.dealRoom.name || "Untitled Deal",
        initiatorName: party.name || "A party",
        dealRoomId: input.dealRoomId,
      }).catch((err) =>
        logger.error("Failed to send joint counsel assignment email", { err: String(err) })
      );

      // Fire-and-forget: notify the other party
      if (otherParty?.email) {
        sendJointCounselNotificationEmail({
          to: otherParty.email,
          partyName: otherParty.name || otherParty.email,
          dealName: party.dealRoom.name || "Untitled Deal",
          supervisorName: supervisor.name || supervisor.email,
          dealRoomId: input.dealRoomId,
        }).catch((err) =>
          logger.error("Failed to send joint counsel notification email", { err: String(err) })
        );
      }

      return { success: true };
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
