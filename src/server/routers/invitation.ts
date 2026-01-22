import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  DealRoomStatus,
  PartyRole,
  PartyStatus,
  InvitationStatus,
} from "@prisma/client";
import { addDays } from "date-fns";

export const invitationRouter = createTRPCRouter({
  // Send an invitation to the respondent
  send: protectedProcedure
    .input(
      z.object({
        dealRoomId: z.string(),
        email: z.string().email(),
        name: z.string().optional(),
        company: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get the deal room
      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: {
          parties: true,
          invitations: {
            where: {
              status: InvitationStatus.PENDING,
            },
          },
        },
      });

      if (!dealRoom) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal room not found",
        });
      }

      // Verify user is the initiator
      const initiator = dealRoom.parties.find(
        (p) => p.role === PartyRole.INITIATOR && p.userId === userId
      );
      if (!initiator) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the initiator can send invitations",
        });
      }

      // Check if there's already a respondent
      const existingRespondent = dealRoom.parties.find(
        (p) => p.role === PartyRole.RESPONDENT
      );
      if (existingRespondent) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A respondent has already been invited",
        });
      }

      // Cancel any existing pending invitations
      if (dealRoom.invitations.length > 0) {
        await ctx.prisma.invitation.updateMany({
          where: {
            dealRoomId: input.dealRoomId,
            status: InvitationStatus.PENDING,
          },
          data: {
            status: InvitationStatus.CANCELLED,
          },
        });
      }

      // Create the respondent party (without user link yet)
      await ctx.prisma.dealRoomParty.create({
        data: {
          dealRoomId: input.dealRoomId,
          role: PartyRole.RESPONDENT,
          status: PartyStatus.PENDING,
          email: input.email,
          name: input.name,
          company: input.company,
        },
      });

      // Create the invitation
      const invitation = await ctx.prisma.invitation.create({
        data: {
          dealRoomId: input.dealRoomId,
          email: input.email,
          sentById: userId,
          expiresAt: addDays(new Date(), 14), // 14 days to accept
        },
      });

      // Update deal room status
      await ctx.prisma.dealRoom.update({
        where: { id: input.dealRoomId },
        data: { status: DealRoomStatus.AWAITING_RESPONSE },
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: input.dealRoomId,
          userId,
          action: "INVITATION_SENT",
          details: {
            email: input.email,
            invitationId: invitation.id,
          },
        },
      });

      // In production, send email via Resend here
      // await sendInvitationEmail(input.email, invitation.token, dealRoom.name);

      return { invitationId: invitation.id, token: invitation.token };
    }),

  // Get invitation details (for respondent viewing)
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const invitation = await ctx.prisma.invitation.findUnique({
        where: { token: input.token },
        include: {
          dealRoom: {
            include: {
              contractTemplate: true,
              parties: {
                where: { role: PartyRole.INITIATOR },
                include: {
                  user: {
                    select: {
                      name: true,
                      email: true,
                    },
                  },
                },
              },
              _count: {
                select: { clauses: true },
              },
            },
          },
          sentBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      const initiatorParty = invitation.dealRoom.parties[0];
      const invitedBy = {
        name: initiatorParty?.name || initiatorParty?.user?.name || null,
        email: initiatorParty?.email || initiatorParty?.user?.email || invitation.sentBy.email,
        company: initiatorParty?.company || null,
      };

      // Base data structure
      const baseData = {
        id: invitation.id,
        email: invitation.email,
        name: invitation.dealRoom.parties.find(p => p.role !== PartyRole.INITIATOR)?.name || null,
        company: invitation.dealRoom.parties.find(p => p.role !== PartyRole.INITIATOR)?.company || null,
        expiresAt: invitation.expiresAt,
        dealRoom: {
          name: invitation.dealRoom.name,
          contractTemplate: {
            displayName: invitation.dealRoom.contractTemplate.displayName,
          },
          _count: {
            clauses: invitation.dealRoom._count.clauses,
          },
        },
        invitedBy,
      };

      // Check if expired
      if (invitation.expiresAt < new Date()) {
        return {
          ...baseData,
          status: "EXPIRED" as const,
        };
      }

      // Check if already accepted
      if (invitation.status === InvitationStatus.ACCEPTED) {
        return {
          ...baseData,
          status: "ACCEPTED" as const,
          dealRoomId: invitation.dealRoomId,
        };
      }

      if (invitation.status === InvitationStatus.CANCELLED) {
        return {
          ...baseData,
          status: "CANCELLED" as const,
        };
      }

      return {
        ...baseData,
        status: "PENDING" as const,
        dealRoomId: invitation.dealRoomId,
      };
    }),

  // Accept an invitation
  accept: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const userEmail = ctx.session.user.email!;

      const invitation = await ctx.prisma.invitation.findUnique({
        where: { token: input.token },
        include: {
          dealRoom: {
            include: {
              parties: true,
            },
          },
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation is no longer valid",
        });
      }

      if (invitation.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation has expired",
        });
      }

      // Check if user is the initiator (can't accept own invitation)
      const isInitiator = invitation.dealRoom.parties.some(
        (p) => p.role === PartyRole.INITIATOR && p.userId === userId
      );
      if (isInitiator) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot accept your own invitation",
        });
      }

      // Find the respondent party and link to user
      const respondentParty = invitation.dealRoom.parties.find(
        (p) => p.role === PartyRole.RESPONDENT
      );
      if (!respondentParty) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Respondent party not found",
        });
      }

      // Update the party with user info
      await ctx.prisma.dealRoomParty.update({
        where: { id: respondentParty.id },
        data: {
          userId,
          email: userEmail,
        },
      });

      // Update invitation
      await ctx.prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: invitation.dealRoomId,
          userId,
          action: "INVITATION_ACCEPTED",
          details: {
            invitationId: invitation.id,
          },
        },
      });

      return { dealRoomId: invitation.dealRoomId };
    }),

  // Resend invitation email
  resend: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const invitation = await ctx.prisma.invitation.findUnique({
        where: { id: input.invitationId },
        include: {
          dealRoom: {
            include: {
              parties: true,
            },
          },
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      // Verify user is the sender
      if (invitation.sentById !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only resend your own invitations",
        });
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation is no longer pending",
        });
      }

      // Update sent time and extend expiration
      await ctx.prisma.invitation.update({
        where: { id: input.invitationId },
        data: {
          sentAt: new Date(),
          expiresAt: addDays(new Date(), 14),
        },
      });

      // In production, resend email via Resend here

      return { success: true };
    }),
});
