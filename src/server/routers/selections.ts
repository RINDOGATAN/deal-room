import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { DealRoomStatus, PartyStatus } from "@prisma/client";

export const selectionsRouter = createTRPCRouter({
  // Get all selections for a deal room clause
  getByClause: protectedProcedure
    .input(
      z.object({
        dealRoomClauseId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get the clause and verify access
      const clause = await ctx.prisma.dealRoomClause.findUnique({
        where: { id: input.dealRoomClauseId },
        include: {
          dealRoom: {
            include: {
              parties: true,
            },
          },
          selections: {
            include: {
              option: true,
              party: true,
            },
          },
        },
      });

      if (!clause) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clause not found",
        });
      }

      const party = clause.dealRoom.parties.find((p) => p.userId === userId);
      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this deal room",
        });
      }

      // Only return own selection until both parties have submitted
      const bothSubmitted = clause.dealRoom.parties.every(
        (p) => p.status === PartyStatus.SUBMITTED || p.status === PartyStatus.REVIEWING || p.status === PartyStatus.ACCEPTED
      );

      if (bothSubmitted) {
        return clause.selections;
      } else {
        // Only return the current user's selection
        return clause.selections.filter((s) => s.partyId === party.id);
      }
    }),

  // Save or update a selection
  upsert: protectedProcedure
    .input(
      z.object({
        dealRoomClauseId: z.string(),
        optionId: z.string(),
        priority: z.number().min(1).max(5).default(3),
        flexibility: z.number().min(1).max(5).default(3),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get the clause and verify access
      const clause = await ctx.prisma.dealRoomClause.findUnique({
        where: { id: input.dealRoomClauseId },
        include: {
          dealRoom: {
            include: {
              parties: true,
            },
          },
          clauseTemplate: {
            include: {
              options: true,
            },
          },
        },
      });

      if (!clause) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clause not found",
        });
      }

      const party = clause.dealRoom.parties.find((p) => p.userId === userId);
      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this deal room",
        });
      }

      // Check if party has already submitted
      if (party.status === PartyStatus.SUBMITTED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already submitted your selections",
        });
      }

      // Verify the option belongs to this clause
      const validOption = clause.clauseTemplate.options.some(
        (o) => o.id === input.optionId
      );
      if (!validOption) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid option for this clause",
        });
      }

      // Upsert the selection
      const selection = await ctx.prisma.partySelection.upsert({
        where: {
          dealRoomClauseId_partyId: {
            dealRoomClauseId: input.dealRoomClauseId,
            partyId: party.id,
          },
        },
        create: {
          dealRoomClauseId: input.dealRoomClauseId,
          partyId: party.id,
          optionId: input.optionId,
          priority: input.priority,
          flexibility: input.flexibility,
          notes: input.notes,
        },
        update: {
          optionId: input.optionId,
          priority: input.priority,
          flexibility: input.flexibility,
          notes: input.notes,
        },
        include: {
          option: true,
        },
      });

      return selection;
    }),

  // Get all selections for the current user in a deal room
  getMySelections: protectedProcedure
    .input(
      z.object({
        dealRoomId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get the deal room and party
      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: {
          parties: true,
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

      const selections = await ctx.prisma.partySelection.findMany({
        where: {
          partyId: party.id,
        },
        include: {
          option: true,
          dealRoomClause: {
            include: {
              clauseTemplate: true,
            },
          },
        },
      });

      return selections;
    }),

  // Bulk save selections (for saving progress)
  bulkSave: protectedProcedure
    .input(
      z.object({
        dealRoomId: z.string(),
        selections: z.array(
          z.object({
            dealRoomClauseId: z.string(),
            optionId: z.string(),
            priority: z.number().min(1).max(5).default(3),
            flexibility: z.number().min(1).max(5).default(3),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get the deal room and party
      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: {
          parties: true,
          clauses: {
            include: {
              clauseTemplate: {
                include: {
                  options: true,
                },
              },
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

      if (party.status === PartyStatus.SUBMITTED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already submitted your selections",
        });
      }

      // Validate all selections
      for (const selection of input.selections) {
        const clause = dealRoom.clauses.find(
          (c) => c.id === selection.dealRoomClauseId
        );
        if (!clause) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid clause: ${selection.dealRoomClauseId}`,
          });
        }

        const validOption = clause.clauseTemplate.options.some(
          (o) => o.id === selection.optionId
        );
        if (!validOption) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid option for clause: ${selection.dealRoomClauseId}`,
          });
        }
      }

      // Perform bulk upsert
      const results = await ctx.prisma.$transaction(
        input.selections.map((selection) =>
          ctx.prisma.partySelection.upsert({
            where: {
              dealRoomClauseId_partyId: {
                dealRoomClauseId: selection.dealRoomClauseId,
                partyId: party.id,
              },
            },
            create: {
              dealRoomClauseId: selection.dealRoomClauseId,
              partyId: party.id,
              optionId: selection.optionId,
              priority: selection.priority,
              flexibility: selection.flexibility,
              notes: selection.notes,
            },
            update: {
              optionId: selection.optionId,
              priority: selection.priority,
              flexibility: selection.flexibility,
              notes: selection.notes,
            },
          })
        )
      );

      return { savedCount: results.length };
    }),
});
