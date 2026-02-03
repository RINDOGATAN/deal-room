import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { DealRoomStatus, PartyRole, PartyStatus, ClauseStatus, InvitationStatus, GoverningLaw } from "@prisma/client";
import { checkDealCreationEntitlement } from "../services/licensing/entitlement";

// Map GoverningLaw enum to jurisdiction strings for entitlement checking
const GOVERNING_LAW_TO_JURISDICTION: Record<string, string> = {
  CALIFORNIA: "US-CA",
  ENGLAND_WALES: "GB",
  SPAIN: "ES",
};

export const dealRouter = createTRPCRouter({
  // List all deal rooms for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const userEmail = ctx.session.user.email;

    // Auto-accept any pending invitations for this user's email
    // This enables seamless dev testing - Bob sees Alice's deal immediately
    if (userEmail) {
      const pendingInvitations = await ctx.prisma.invitation.findMany({
        where: {
          email: userEmail,
          status: InvitationStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
        include: {
          dealRoom: {
            include: {
              parties: true,
            },
          },
        },
      });

      for (const invitation of pendingInvitations) {
        // Find the respondent party that matches this invitation
        const respondentParty = invitation.dealRoom.parties.find(
          (p) => p.role === PartyRole.RESPONDENT && !p.userId
        );

        if (respondentParty) {
          // Link the party to this user
          await ctx.prisma.dealRoomParty.update({
            where: { id: respondentParty.id },
            data: { userId, email: userEmail },
          });

          // Mark invitation as accepted
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
              action: "INVITATION_AUTO_ACCEPTED",
              details: {
                invitationId: invitation.id,
                reason: "Email match on login",
              },
            },
          });
        }
      }
    }

    const dealRooms = await ctx.prisma.dealRoom.findMany({
      where: {
        parties: {
          some: {
            userId,
          },
        },
      },
      include: {
        contractTemplate: true,
        parties: {
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
          select: {
            clauses: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return dealRooms;
  }),

  // Get a single deal room by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.id },
        include: {
          contractTemplate: true,
          parties: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  company: true,
                },
              },
            },
          },
          clauses: {
            include: {
              clauseTemplate: {
                include: {
                  options: {
                    orderBy: { order: "asc" },
                  },
                },
              },
              selections: {
                include: {
                  party: true,
                  option: true,
                },
              },
              compromiseSuggestions: {
                orderBy: { roundNumber: "desc" },
                take: 1,
              },
            },
            orderBy: {
              clauseTemplate: {
                order: "asc",
              },
            },
          },
          rounds: {
            orderBy: { roundNumber: "desc" },
            take: 1,
          },
        },
      });

      if (!dealRoom) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal room not found",
        });
      }

      // Check if user has access
      const isParty = dealRoom.parties.some((p) => p.userId === userId);
      if (!isParty) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this deal room",
        });
      }

      // Get current user's party role
      const currentParty = dealRoom.parties.find((p) => p.userId === userId);

      return {
        ...dealRoom,
        currentUserRole: currentParty?.role,
        currentPartyId: currentParty?.id,
      };
    }),

  // Create a new deal room
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        contractType: z.string(),
        governingLaw: z.enum(["CALIFORNIA", "ENGLAND_WALES", "SPAIN"]),
        initiatorCompany: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const userEmail = ctx.session.user.email!;
      const userName = ctx.session.user.name;

      // Find the contract template
      const template = await ctx.prisma.contractTemplate.findUnique({
        where: { contractType: input.contractType },
        include: {
          clauses: {
            orderBy: { order: "asc" },
          },
          skillPackage: true,
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contract template not found",
        });
      }

      // Check entitlement if this is a licensed skill
      if (template.skillPackageId) {
        // Find customer by email
        const customer = await ctx.prisma.customer.findFirst({
          where: { email: userEmail },
        });

        if (!customer) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This contract skill has not been enabled on your account. Please contact us to get access.",
          });
        }

        // Check entitlement for skill and jurisdiction
        const jurisdiction = GOVERNING_LAW_TO_JURISDICTION[input.governingLaw];
        const entitlement = await checkDealCreationEntitlement(
          customer.id,
          input.contractType,
          jurisdiction
        );

        if (!entitlement.entitled) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This contract skill has not been enabled on your account. Please contact us to get access.",
          });
        }
      }

      // Create the deal room with clauses
      const dealRoom = await ctx.prisma.dealRoom.create({
        data: {
          name: input.name,
          contractTemplateId: template.id,
          governingLaw: input.governingLaw as GoverningLaw,
          status: DealRoomStatus.DRAFT,
          parties: {
            create: {
              userId,
              role: PartyRole.INITIATOR,
              status: PartyStatus.PENDING,
              email: userEmail,
              name: userName,
              company: input.initiatorCompany,
            },
          },
          clauses: {
            create: template.clauses.map((clause) => ({
              clauseTemplateId: clause.id,
              status: ClauseStatus.PENDING,
            })),
          },
        },
        include: {
          parties: true,
          clauses: true,
        },
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: dealRoom.id,
          userId,
          action: "DEAL_ROOM_CREATED",
          details: {
            name: input.name,
            contractType: input.contractType,
            governingLaw: input.governingLaw,
          },
        },
      });

      return dealRoom;
    }),

  // Update deal room name
  updateName: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Check if user is the initiator
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: {
          dealRoomId: input.id,
          userId,
          role: PartyRole.INITIATOR,
        },
      });

      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the initiator can update the deal room name",
        });
      }

      const dealRoom = await ctx.prisma.dealRoom.update({
        where: { id: input.id },
        data: { name: input.name },
      });

      return dealRoom;
    }),

  // Cancel a deal room
  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Check if user is a party
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: {
          dealRoomId: input.id,
          userId,
        },
      });

      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this deal room",
        });
      }

      const dealRoom = await ctx.prisma.dealRoom.update({
        where: { id: input.id },
        data: { status: DealRoomStatus.CANCELLED },
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: input.id,
          userId,
          action: "DEAL_ROOM_CANCELLED",
          details: {
            cancelledBy: party.role,
          },
        },
      });

      return dealRoom;
    }),

  // Get deal room progress (for dashboard)
  getProgress: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.id },
        include: {
          clauses: {
            include: {
              selections: true,
            },
          },
          parties: true,
        },
      });

      if (!dealRoom) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal room not found",
        });
      }

      const totalClauses = dealRoom.clauses.length;
      const initiatorParty = dealRoom.parties.find(
        (p) => p.role === PartyRole.INITIATOR
      );
      const respondentParty = dealRoom.parties.find(
        (p) => p.role === PartyRole.RESPONDENT
      );

      const initiatorSelections = dealRoom.clauses.filter((c) =>
        c.selections.some((s) => s.partyId === initiatorParty?.id)
      ).length;

      const respondentSelections = dealRoom.clauses.filter((c) =>
        c.selections.some((s) => s.partyId === respondentParty?.id)
      ).length;

      const agreedClauses = dealRoom.clauses.filter(
        (c) => c.status === ClauseStatus.AGREED
      ).length;

      return {
        totalClauses,
        initiatorProgress: {
          completed: initiatorSelections,
          percentage: Math.round((initiatorSelections / totalClauses) * 100),
        },
        respondentProgress: {
          completed: respondentSelections,
          percentage: Math.round((respondentSelections / totalClauses) * 100),
        },
        agreedClauses: {
          completed: agreedClauses,
          percentage: Math.round((agreedClauses / totalClauses) * 100),
        },
      };
    }),

  // Submit all selections (transition to next status)
  submitSelections: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get the deal room and party
      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: {
          parties: true,
          clauses: {
            include: {
              selections: true,
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

      const party = dealRoom.parties.find((p) => p.userId === userId);
      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this deal room",
        });
      }

      // Check if all clauses have selections
      const partySelections = dealRoom.clauses.filter((c) =>
        c.selections.some((s) => s.partyId === party.id)
      );

      if (partySelections.length < dealRoom.clauses.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You must make selections for all clauses before submitting",
        });
      }

      // Update party status
      await ctx.prisma.dealRoomParty.update({
        where: { id: party.id },
        data: {
          status: PartyStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });

      // Check if both parties have submitted
      const otherParty = dealRoom.parties.find((p) => p.id !== party.id);
      const bothSubmitted = otherParty?.status === PartyStatus.SUBMITTED;

      // Update deal room status
      let newStatus = dealRoom.status;
      if (party.role === PartyRole.INITIATOR && !otherParty) {
        // Initiator submitted but no respondent yet - keep as DRAFT until invitation
        newStatus = DealRoomStatus.DRAFT;
      } else if (bothSubmitted) {
        newStatus = DealRoomStatus.NEGOTIATING;
      }

      await ctx.prisma.dealRoom.update({
        where: { id: input.dealRoomId },
        data: { status: newStatus },
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: input.dealRoomId,
          userId,
          action: "SELECTIONS_SUBMITTED",
          details: {
            role: party.role,
          },
        },
      });

      return { success: true, bothSubmitted };
    }),
});
