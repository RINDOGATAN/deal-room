import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const attorneyReviewRouter = createTRPCRouter({
  /**
   * List available attorneys (supervisors) for review assignment.
   * Marks the one already selected by the other party as unavailable.
   */
  listAvailableAttorneys: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify caller is party to the deal and deal is AGREED
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
          message: "Deal must be in AGREED status to request attorney review",
        });
      }

      // Find the other party's selected attorney
      const otherParty = party.dealRoom.parties.find(
        (p) => p.id !== party.id
      );
      const otherAttorneyId = otherParty?.attorneySupervisorId || null;

      // Fetch all active supervisors
      const supervisors = await ctx.prisma.supervisor.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      return supervisors.map((s) => ({
        ...s,
        unavailable: s.id === otherAttorneyId,
      }));
    }),

  /**
   * Request attorney review for the calling party.
   */
  requestReview: protectedProcedure
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

      if (party.attorneyReviewRequested) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already requested attorney review",
        });
      }

      // Verify supervisor is active
      const supervisor = await ctx.prisma.supervisor.findUnique({
        where: { id: input.supervisorId },
      });

      if (!supervisor || !supervisor.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected attorney is not available",
        });
      }

      // Check conflict of interest — other party can't have the same attorney
      const otherParty = party.dealRoom.parties.find(
        (p) => p.id !== party.id
      );
      if (otherParty?.attorneySupervisorId === input.supervisorId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This attorney is already assigned to the other party. Please select a different attorney.",
        });
      }

      await ctx.prisma.$transaction([
        // Update party with review request
        ctx.prisma.dealRoomParty.update({
          where: { id: party.id },
          data: {
            attorneyReviewRequested: true,
            attorneyReviewRequestedAt: new Date(),
            attorneySupervisorId: input.supervisorId,
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
            action: "ATTORNEY_REVIEW_REQUESTED",
            details: {
              supervisorId: input.supervisorId,
              supervisorName: supervisor.name,
              supervisorEmail: supervisor.email,
              partyRole: party.role,
            },
          },
        }),
      ]);

      return { success: true };
    }),

  /**
   * Cancel a pending (unapproved) attorney review.
   */
  cancelReview: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: {
          dealRoomId: input.dealRoomId,
          userId: ctx.session.user.id,
        },
      });

      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a party to this deal",
        });
      }

      if (
        !party.attorneyReviewRequested ||
        party.attorneyReviewApprovedAt
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active (unapproved) review to cancel",
        });
      }

      const supervisorId = party.attorneySupervisorId;

      const operations = [
        // Reset party review fields
        ctx.prisma.dealRoomParty.update({
          where: { id: party.id },
          data: {
            attorneyReviewRequested: false,
            attorneyReviewRequestedAt: null,
            attorneySupervisorId: null,
            attorneyReviewApprovedAt: null,
          },
        }),
        // Audit log
        ctx.prisma.auditLog.create({
          data: {
            dealRoomId: input.dealRoomId,
            userId: ctx.session.user.id,
            action: "ATTORNEY_REVIEW_CANCELLED",
            details: {
              supervisorId,
              partyRole: party.role,
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
          }) as any
        );
      }

      await ctx.prisma.$transaction(operations);

      return { success: true };
    }),

  /**
   * Get review status for both parties in a deal.
   */
  getReviewStatus: protectedProcedure
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
              parties: {
                include: {
                  attorneySupervisor: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
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

      const myParty = party.dealRoom.parties.find(
        (p) => p.id === party.id
      )!;
      const otherParty = party.dealRoom.parties.find(
        (p) => p.id !== party.id
      );

      const myReview = myParty.attorneyReviewRequested
        ? {
            requested: true,
            supervisorName:
              myParty.attorneySupervisor?.name ||
              myParty.attorneySupervisor?.email ||
              null,
            requestedAt: myParty.attorneyReviewRequestedAt,
            approvedAt: myParty.attorneyReviewApprovedAt,
          }
        : null;

      const otherPartyReviewActive =
        !!otherParty?.attorneyReviewRequested &&
        !otherParty?.attorneyReviewApprovedAt;

      // Can proceed if no party has an active (unapproved) review
      const myReviewActive =
        myParty.attorneyReviewRequested &&
        !myParty.attorneyReviewApprovedAt;

      const canProceedToSigning = !myReviewActive && !otherPartyReviewActive;

      return {
        myReview,
        otherPartyReviewActive,
        canProceedToSigning,
      };
    }),
});
