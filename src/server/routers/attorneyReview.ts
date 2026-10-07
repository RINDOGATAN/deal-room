// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { inviteOwnLawyer } from "@/server/services/attorney/ownLawyer";

/**
 * Party counsel (Stage A). Since the owner's decision of 6 October 2026 a
 * party involves a lawyer only by inviting one of its own choice, by
 * e-mail: there is no list of lawyers for parties (the former
 * listAvailableAttorneys) and no request that names a platform-chosen
 * supervisor id (the former requestReview). Admins still see and assign
 * supervisors through the admin router.
 */
export const attorneyReviewRouter = createTRPCRouter({
  /**
   * Invite a lawyer of the caller's choice, by e-mail, to review this
   * deal for the caller's side (owner's decision E1, step 1). Same review
   * stage as before; no fee, no recommendation, no directory.
   * Available whatever `features.startupCoverage` says: it is the only way
   * a party involves a lawyer, so it can never be switched off.
   */
  inviteOwnLawyer: protectedProcedure
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
      const result = await inviteOwnLawyer(ctx.prisma, {
        partyId: party.id,
        lawyerEmail: input.email,
        lawyerName: input.name,
        actorUserId: ctx.session.user.id,
        via: "app",
        lang: input.lang,
      });
      if (!result.ok) {
        const code =
          result.status === 404 ? "NOT_FOUND"
          : result.status === 403 ? "FORBIDDEN"
          : result.status === 429 ? "TOO_MANY_REQUESTS"
          : result.status === 409 ? "CONFLICT"
          : "BAD_REQUEST";
        throw new TRPCError({ code, message: result.error });
      }
      return { success: true, emailSent: result.emailSent };
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

      const operations: Prisma.PrismaPromise<unknown>[] = [
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
          })
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
              lawyerVetting: {
                include: {
                  lawyer: { select: { name: true, email: true } },
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

      // Lawyer vetting info
      const vetting = party.dealRoom.lawyerVetting;
      const lawyerVetted = !!vetting;
      const vettingLawyerName = vetting
        ? vetting.lawyer.name || vetting.lawyer.email
        : null;

      // If lawyer-vetted and user is the initiator, they don't need attorney review
      const isInitiator = myParty.role === "INITIATOR";
      const suppressReviewForInitiator = lawyerVetted && isInitiator;

      return {
        myReview,
        otherPartyReviewActive,
        canProceedToSigning,
        lawyerVetted,
        vettingLawyerName,
        suppressReviewForInitiator,
      };
    }),
});
