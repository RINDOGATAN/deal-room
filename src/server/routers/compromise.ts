import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { PartyRole, PartyStatus, ClauseStatus, DealRoomStatus, RoundStatus, ProposalStatus } from "@prisma/client";
import { calculateCompromise, globalFairnessPass, type CompromiseInput, type OptionInput } from "../services/compromise/engine";

export const compromiseRouter = createTRPCRouter({
  // Generate compromise suggestions for a deal room
  generate: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get the deal room with all necessary data
      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: {
          parties: true,
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

      // Verify both parties have submitted
      const initiator = dealRoom.parties.find((p) => p.role === PartyRole.INITIATOR);
      const respondent = dealRoom.parties.find((p) => p.role === PartyRole.RESPONDENT);

      if (!initiator || !respondent) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Both parties must be present",
        });
      }

      if (
        initiator.status === PartyStatus.PENDING ||
        respondent.status === PartyStatus.PENDING
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Both parties must submit their selections first",
        });
      }

      const roundNumber = dealRoom.currentRound + 1;

      // Create negotiation round
      const round = await ctx.prisma.negotiationRound.create({
        data: {
          dealRoomId: input.dealRoomId,
          roundNumber,
          initiatedBy: PartyRole.INITIATOR,
          status: RoundStatus.PENDING_RESPONSE,
        },
      });

      // Generate compromise for each clause
      const suggestions = [];
      const divergentClauses: Array<{
        clauseId: string;
        result: ReturnType<typeof calculateCompromise>;
        options: OptionInput[];
        partyAOptionOrder: number;
        partyBOptionOrder: number;
      }> = [];

      for (const clause of dealRoom.clauses) {
        const initiatorSelection = clause.selections.find(
          (s) => s.partyId === initiator.id
        );
        const respondentSelection = clause.selections.find(
          (s) => s.partyId === respondent.id
        );

        if (!initiatorSelection || !respondentSelection) {
          continue;
        }

        // Check if they already agree
        if (initiatorSelection.optionId === respondentSelection.optionId) {
          // Mark clause as agreed
          await ctx.prisma.dealRoomClause.update({
            where: { id: clause.id },
            data: {
              status: ClauseStatus.AGREED,
              agreedOptionId: initiatorSelection.optionId,
            },
          });

          suggestions.push({
            clauseId: clause.id,
            suggestedOptionId: initiatorSelection.optionId,
            satisfactionPartyA: 100,
            satisfactionPartyB: 100,
            reasoning: "Both parties selected the same option.",
            agreed: true,
          });
          continue;
        }

        // Build input for compromise algorithm
        const options: OptionInput[] = clause.clauseTemplate.options.map((opt) => ({
          id: opt.id,
          order: opt.order,
          label: opt.label,
          biasPartyA: opt.biasPartyA,
          biasPartyB: opt.biasPartyB,
        }));

        const compromiseInput: CompromiseInput = {
          partyASelection: {
            optionId: initiatorSelection.optionId,
            priority: initiatorSelection.priority,
            flexibility: initiatorSelection.flexibility,
            biasPartyA: initiatorSelection.option.biasPartyA,
            biasPartyB: initiatorSelection.option.biasPartyB,
          },
          partyBSelection: {
            optionId: respondentSelection.optionId,
            priority: respondentSelection.priority,
            flexibility: respondentSelection.flexibility,
            biasPartyA: respondentSelection.option.biasPartyA,
            biasPartyB: respondentSelection.option.biasPartyB,
          },
          options,
          clauseTitle: clause.clauseTemplate.title,
        };

        const result = calculateCompromise(compromiseInput);

        // Get option orders for fairness pass
        const optionA = options.find((o) => o.id === initiatorSelection.optionId);
        const optionB = options.find((o) => o.id === respondentSelection.optionId);

        divergentClauses.push({
          clauseId: clause.id,
          result,
          options,
          partyAOptionOrder: optionA?.order || 0,
          partyBOptionOrder: optionB?.order || 0,
        });
      }

      // Apply global fairness pass to rebalance if needed
      const fairnessAdjusted = globalFairnessPass(divergentClauses);

      // Save adjusted suggestions to database
      for (const adjusted of fairnessAdjusted) {
        await ctx.prisma.compromiseSuggestion.create({
          data: {
            dealRoomClauseId: adjusted.clauseId,
            roundNumber,
            suggestedOptionId: adjusted.result.suggestedOptionId,
            satisfactionPartyA: adjusted.result.satisfactionPartyA,
            satisfactionPartyB: adjusted.result.satisfactionPartyB,
            reasoning: adjusted.result.reasoning,
          },
        });

        // Update clause status
        await ctx.prisma.dealRoomClause.update({
          where: { id: adjusted.clauseId },
          data: { status: ClauseStatus.SUGGESTED },
        });

        suggestions.push({
          clauseId: adjusted.clauseId,
          ...adjusted.result,
          agreed: false,
        });
      }

      // Update deal room round and status
      await ctx.prisma.dealRoom.update({
        where: { id: input.dealRoomId },
        data: {
          currentRound: roundNumber,
          status: DealRoomStatus.NEGOTIATING,
        },
      });

      // Update party statuses
      await ctx.prisma.dealRoomParty.updateMany({
        where: {
          dealRoomId: input.dealRoomId,
        },
        data: {
          status: PartyStatus.REVIEWING,
        },
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: input.dealRoomId,
          userId,
          action: "COMPROMISE_GENERATED",
          details: {
            roundNumber,
            suggestionsCount: suggestions.length,
          },
        },
      });

      return { roundNumber, suggestions };
    }),

  // Get current compromise suggestions for a deal room
  getCurrent: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: {
          parties: true,
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
                  option: true,
                  party: true,
                },
              },
              compromiseSuggestions: {
                orderBy: { roundNumber: "desc" },
                take: 1,
                include: {
                  suggestedOption: true,
                },
              },
            },
            orderBy: {
              clauseTemplate: {
                order: "asc",
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

      return dealRoom.clauses.map((clause) => ({
        clauseId: clause.id,
        clauseTitle: clause.clauseTemplate.title,
        clauseDescription: clause.clauseTemplate.plainDescription,
        category: clause.clauseTemplate.category,
        status: clause.status,
        options: clause.clauseTemplate.options,
        selections: clause.selections,
        suggestion: clause.compromiseSuggestions[0] || null,
      }));
    }),

  // Accept or reject a compromise suggestion
  respond: protectedProcedure
    .input(
      z.object({
        dealRoomClauseId: z.string(),
        accept: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const clause = await ctx.prisma.dealRoomClause.findUnique({
        where: { id: input.dealRoomClauseId },
        include: {
          dealRoom: {
            include: {
              parties: true,
            },
          },
          compromiseSuggestions: {
            orderBy: { roundNumber: "desc" },
            take: 1,
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

      const suggestion = clause.compromiseSuggestions[0];
      if (!suggestion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No compromise suggestion found",
        });
      }

      // Update the suggestion based on party role
      const updateData =
        party.role === PartyRole.INITIATOR
          ? { partyAAccepted: input.accept }
          : { partyBAccepted: input.accept };

      const updated = await ctx.prisma.compromiseSuggestion.update({
        where: { id: suggestion.id },
        data: updateData,
      });

      // Check if both parties have accepted
      const partyAAccepted = party.role === PartyRole.INITIATOR ? input.accept : suggestion.partyAAccepted;
      const partyBAccepted = party.role === PartyRole.RESPONDENT ? input.accept : suggestion.partyBAccepted;

      if (partyAAccepted === true && partyBAccepted === true) {
        // Mark clause as agreed
        await ctx.prisma.dealRoomClause.update({
          where: { id: input.dealRoomClauseId },
          data: {
            status: ClauseStatus.AGREED,
            agreedOptionId: suggestion.suggestedOptionId,
          },
        });

        // Check if all clauses are agreed
        const allClauses = await ctx.prisma.dealRoomClause.findMany({
          where: { dealRoomId: clause.dealRoomId },
        });

        const allAgreed = allClauses.every(
          (c) => c.status === ClauseStatus.AGREED
        );

        if (allAgreed) {
          await ctx.prisma.dealRoom.update({
            where: { id: clause.dealRoomId },
            data: { status: DealRoomStatus.AGREED },
          });

          // Update party statuses
          await ctx.prisma.dealRoomParty.updateMany({
            where: { dealRoomId: clause.dealRoomId },
            data: { status: PartyStatus.ACCEPTED },
          });
        }
      }

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: clause.dealRoomId,
          userId,
          action: input.accept ? "COMPROMISE_ACCEPTED" : "COMPROMISE_REJECTED",
          details: {
            clauseId: input.dealRoomClauseId,
            suggestedOptionId: suggestion.suggestedOptionId,
          },
        },
      });

      return updated;
    }),

  // Get overall satisfaction scores for both parties
  getSatisfactionScores: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: {
          parties: true,
          clauses: {
            include: {
              compromiseSuggestions: {
                orderBy: { roundNumber: "desc" },
                take: 1,
              },
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

      // Calculate weighted satisfaction
      const initiator = dealRoom.parties.find((p) => p.role === PartyRole.INITIATOR);
      const respondent = dealRoom.parties.find((p) => p.role === PartyRole.RESPONDENT);

      let totalWeightA = 0;
      let totalWeightB = 0;
      let weightedSatisfactionA = 0;
      let weightedSatisfactionB = 0;

      for (const clause of dealRoom.clauses) {
        const suggestion = clause.compromiseSuggestions[0];
        if (!suggestion) continue;

        const selectionA = clause.selections.find(
          (s) => s.partyId === initiator?.id
        );
        const selectionB = clause.selections.find(
          (s) => s.partyId === respondent?.id
        );

        const weightA = selectionA?.priority || 3;
        const weightB = selectionB?.priority || 3;

        totalWeightA += weightA;
        totalWeightB += weightB;
        weightedSatisfactionA += suggestion.satisfactionPartyA * weightA;
        weightedSatisfactionB += suggestion.satisfactionPartyB * weightB;
      }

      return {
        partyA: {
          name: initiator?.name || initiator?.email || "Party A",
          satisfaction:
            totalWeightA > 0
              ? Math.round(weightedSatisfactionA / totalWeightA)
              : 0,
        },
        partyB: {
          name: respondent?.name || respondent?.email || "Party B",
          satisfaction:
            totalWeightB > 0
              ? Math.round(weightedSatisfactionB / totalWeightB)
              : 0,
        },
      };
    }),

  // Submit a counter-proposal when rejecting a suggestion
  counterPropose: protectedProcedure
    .input(
      z.object({
        dealRoomClauseId: z.string(),
        proposedOptionId: z.string(),
        rationale: z.string().optional(),
        newPriority: z.number().min(1).max(5).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const clause = await ctx.prisma.dealRoomClause.findUnique({
        where: { id: input.dealRoomClauseId },
        include: {
          dealRoom: {
            include: {
              parties: true,
              rounds: {
                orderBy: { roundNumber: "desc" },
                take: 1,
              },
            },
          },
          compromiseSuggestions: {
            orderBy: { roundNumber: "desc" },
            take: 1,
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

      const currentRound = clause.dealRoom.rounds[0];
      if (!currentRound) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active negotiation round",
        });
      }

      const suggestion = clause.compromiseSuggestions[0];
      if (!suggestion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No compromise suggestion found to counter",
        });
      }

      // Mark the suggestion as rejected by this party
      const updateData =
        party.role === PartyRole.INITIATOR
          ? { partyAAccepted: false }
          : { partyBAccepted: false };

      await ctx.prisma.compromiseSuggestion.update({
        where: { id: suggestion.id },
        data: updateData,
      });

      // Create the counter-proposal
      const counterProposal = await ctx.prisma.counterProposal.create({
        data: {
          roundId: currentRound.id,
          dealRoomClauseId: input.dealRoomClauseId,
          partyId: party.id,
          proposedOptionId: input.proposedOptionId,
          rationale: input.rationale,
          newPriority: input.newPriority,
          status: ProposalStatus.PENDING,
        },
        include: {
          proposedOption: true,
        },
      });

      // Update selection priority if provided
      if (input.newPriority) {
        await ctx.prisma.partySelection.updateMany({
          where: {
            dealRoomClauseId: input.dealRoomClauseId,
            partyId: party.id,
          },
          data: {
            priority: input.newPriority,
          },
        });
      }

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: clause.dealRoomId,
          userId,
          action: "COUNTER_PROPOSAL_SUBMITTED",
          details: {
            clauseId: input.dealRoomClauseId,
            proposedOptionId: input.proposedOptionId,
            rationale: input.rationale,
          },
        },
      });

      return counterProposal;
    }),

  // Respond to a counter-proposal (accept or reject)
  respondToCounterProposal: protectedProcedure
    .input(
      z.object({
        counterProposalId: z.string(),
        accept: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const counterProposal = await ctx.prisma.counterProposal.findUnique({
        where: { id: input.counterProposalId },
        include: {
          dealRoomClause: {
            include: {
              dealRoom: {
                include: {
                  parties: true,
                },
              },
            },
          },
          party: true,
          proposedOption: true,
        },
      });

      if (!counterProposal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Counter-proposal not found",
        });
      }

      const dealRoom = counterProposal.dealRoomClause.dealRoom;
      const respondingParty = dealRoom.parties.find((p) => p.userId === userId);

      if (!respondingParty) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this deal room",
        });
      }

      // Can't respond to your own counter-proposal
      if (counterProposal.partyId === respondingParty.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot respond to your own counter-proposal",
        });
      }

      if (input.accept) {
        // Accept the counter-proposal
        await ctx.prisma.counterProposal.update({
          where: { id: input.counterProposalId },
          data: { status: ProposalStatus.ACCEPTED },
        });

        // Mark clause as agreed with the proposed option
        await ctx.prisma.dealRoomClause.update({
          where: { id: counterProposal.dealRoomClauseId },
          data: {
            status: ClauseStatus.AGREED,
            agreedOptionId: counterProposal.proposedOptionId,
          },
        });

        // Check if all clauses are agreed
        const allClauses = await ctx.prisma.dealRoomClause.findMany({
          where: { dealRoomId: dealRoom.id },
        });

        const allAgreed = allClauses.every(
          (c) => c.status === ClauseStatus.AGREED
        );

        if (allAgreed) {
          await ctx.prisma.dealRoom.update({
            where: { id: dealRoom.id },
            data: { status: DealRoomStatus.AGREED },
          });

          await ctx.prisma.dealRoomParty.updateMany({
            where: { dealRoomId: dealRoom.id },
            data: { status: PartyStatus.ACCEPTED },
          });
        }

        // Create audit log
        await ctx.prisma.auditLog.create({
          data: {
            dealRoomId: dealRoom.id,
            userId,
            action: "COUNTER_PROPOSAL_ACCEPTED",
            details: {
              counterProposalId: input.counterProposalId,
              clauseId: counterProposal.dealRoomClauseId,
              agreedOptionId: counterProposal.proposedOptionId,
            },
          },
        });

        return { accepted: true, allAgreed };
      } else {
        // Reject the counter-proposal
        await ctx.prisma.counterProposal.update({
          where: { id: input.counterProposalId },
          data: { status: ProposalStatus.REJECTED },
        });

        // Create audit log
        await ctx.prisma.auditLog.create({
          data: {
            dealRoomId: dealRoom.id,
            userId,
            action: "COUNTER_PROPOSAL_REJECTED",
            details: {
              counterProposalId: input.counterProposalId,
              clauseId: counterProposal.dealRoomClauseId,
            },
          },
        });

        return { accepted: false, allAgreed: false };
      }
    }),

  // Get pending counter-proposals for a deal room
  getCounterProposals: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

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

      // Get all counter-proposals for this deal room
      const counterProposals = await ctx.prisma.counterProposal.findMany({
        where: {
          dealRoomClause: {
            dealRoomId: input.dealRoomId,
          },
        },
        include: {
          dealRoomClause: {
            include: {
              clauseTemplate: true,
            },
          },
          party: true,
          proposedOption: true,
          round: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Separate into "from me" and "to me"
      const fromMe = counterProposals.filter((cp) => cp.partyId === party.id);
      const toMe = counterProposals.filter((cp) => cp.partyId !== party.id);

      return {
        fromMe,
        toMe,
        pendingForMe: toMe.filter((cp) => cp.status === ProposalStatus.PENDING),
      };
    }),

  // Generate a new round of suggestions after rejections
  regenerate: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: {
          parties: true,
          clauses: {
            where: {
              status: { not: ClauseStatus.AGREED },
            },
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
                  option: true,
                },
              },
              compromiseSuggestions: {
                orderBy: { roundNumber: "desc" },
                take: 1,
              },
              counterProposals: {
                where: { status: ProposalStatus.PENDING },
                orderBy: { createdAt: "desc" },
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

      const initiator = dealRoom.parties.find((p) => p.role === PartyRole.INITIATOR);
      const respondent = dealRoom.parties.find((p) => p.role === PartyRole.RESPONDENT);

      if (!initiator || !respondent) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Both parties must be present",
        });
      }

      const roundNumber = dealRoom.currentRound + 1;

      // Mark old counter-proposals as superseded
      await ctx.prisma.counterProposal.updateMany({
        where: {
          dealRoomClause: {
            dealRoomId: input.dealRoomId,
          },
          status: ProposalStatus.PENDING,
        },
        data: {
          status: ProposalStatus.SUPERSEDED,
        },
      });

      // Create new negotiation round
      const round = await ctx.prisma.negotiationRound.create({
        data: {
          dealRoomId: input.dealRoomId,
          roundNumber,
          initiatedBy: party.role,
          status: RoundStatus.PENDING_RESPONSE,
        },
      });

      const divergentClauses: Array<{
        clauseId: string;
        result: ReturnType<typeof calculateCompromise>;
        options: OptionInput[];
        partyAOptionOrder: number;
        partyBOptionOrder: number;
      }> = [];

      // Regenerate suggestions for non-agreed clauses
      for (const clause of dealRoom.clauses) {
        const initiatorSelection = clause.selections.find(
          (s) => s.partyId === initiator.id
        );
        const respondentSelection = clause.selections.find(
          (s) => s.partyId === respondent.id
        );

        if (!initiatorSelection || !respondentSelection) continue;

        const options: OptionInput[] = clause.clauseTemplate.options.map((opt) => ({
          id: opt.id,
          order: opt.order,
          label: opt.label,
          biasPartyA: opt.biasPartyA,
          biasPartyB: opt.biasPartyB,
        }));

        // Consider counter-proposals in the new calculation
        // If there's a pending counter-proposal, weight toward that option
        const latestCounterProposal = clause.counterProposals[0];

        const compromiseInput: CompromiseInput = {
          partyASelection: {
            optionId: initiatorSelection.optionId,
            priority: initiatorSelection.priority,
            flexibility: initiatorSelection.flexibility,
            biasPartyA: initiatorSelection.option.biasPartyA,
            biasPartyB: initiatorSelection.option.biasPartyB,
          },
          partyBSelection: {
            optionId: respondentSelection.optionId,
            priority: respondentSelection.priority,
            flexibility: respondentSelection.flexibility,
            biasPartyA: respondentSelection.option.biasPartyA,
            biasPartyB: respondentSelection.option.biasPartyB,
          },
          options,
          clauseTitle: clause.clauseTemplate.title,
        };

        let result = calculateCompromise(compromiseInput);

        // If there's a counter-proposal, strongly consider it
        if (latestCounterProposal) {
          const counterOption = options.find(
            (o) => o.id === latestCounterProposal.proposedOptionId
          );
          if (counterOption) {
            // If the counter-proposal is between the two positions, use it
            const optionA = options.find((o) => o.id === initiatorSelection.optionId);
            const optionB = options.find((o) => o.id === respondentSelection.optionId);

            if (optionA && optionB) {
              const minOrder = Math.min(optionA.order, optionB.order);
              const maxOrder = Math.max(optionA.order, optionB.order);

              if (counterOption.order >= minOrder && counterOption.order <= maxOrder) {
                result = {
                  suggestedOptionId: counterOption.id,
                  satisfactionPartyA: Math.round(
                    100 - (Math.abs(optionA.order - counterOption.order) / (maxOrder - minOrder || 1)) * 50
                  ),
                  satisfactionPartyB: Math.round(
                    100 - (Math.abs(optionB.order - counterOption.order) / (maxOrder - minOrder || 1)) * 50
                  ),
                  reasoning: `For "${clause.clauseTemplate.title}", this suggestion incorporates the counter-proposal as a reasonable middle ground between both parties' positions.`,
                };
              }
            }
          }
        }

        const optionA = options.find((o) => o.id === initiatorSelection.optionId);
        const optionB = options.find((o) => o.id === respondentSelection.optionId);

        divergentClauses.push({
          clauseId: clause.id,
          result,
          options,
          partyAOptionOrder: optionA?.order || 0,
          partyBOptionOrder: optionB?.order || 0,
        });
      }

      // Apply global fairness pass
      const fairnessAdjusted = globalFairnessPass(divergentClauses);

      // Save new suggestions
      for (const adjusted of fairnessAdjusted) {
        await ctx.prisma.compromiseSuggestion.create({
          data: {
            dealRoomClauseId: adjusted.clauseId,
            roundNumber,
            suggestedOptionId: adjusted.result.suggestedOptionId,
            satisfactionPartyA: adjusted.result.satisfactionPartyA,
            satisfactionPartyB: adjusted.result.satisfactionPartyB,
            reasoning: adjusted.result.reasoning,
          },
        });

        await ctx.prisma.dealRoomClause.update({
          where: { id: adjusted.clauseId },
          data: { status: ClauseStatus.SUGGESTED },
        });
      }

      // Update deal room round
      await ctx.prisma.dealRoom.update({
        where: { id: input.dealRoomId },
        data: { currentRound: roundNumber },
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: input.dealRoomId,
          userId,
          action: "COMPROMISE_REGENERATED",
          details: {
            roundNumber,
            clauseCount: fairnessAdjusted.length,
          },
        },
      });

      return { roundNumber, suggestionsCount: fairnessAdjusted.length };
    }),
});
