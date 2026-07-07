// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { PartyRole, PartyStatus, ClauseStatus, DealRoomStatus, RoundStatus, ProposalStatus } from "@prisma/client";
import { calculateCompromise, globalFairnessPass, type CompromiseInput, type OptionInput, type DynamicBiasOverride } from "../services/compromise/engine";
import { cloudApi, type BiasOverrides, type ValidationResult } from "@/lib/cloud-api";
import { assertMutableStatus } from "../services/deal/mutability";
import { createLogger } from "@/lib/logger";

const logger = createLogger("compromise");

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
          contractTemplate: true,
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

      assertMutableStatus(dealRoom.status);

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

      // Fetch dynamic biases from Cloud Intelligence API (degrades to empty)
      let allDynamicBiases: BiasOverrides = {};
      try {
        allDynamicBiases = await cloudApi.getDynamicBiases(
          dealRoom.contractTemplate?.contractType || "",
          dealRoom.governingLaw
        );
      } catch (error) {
        logger.error("Failed to fetch dynamic biases (using static)", { err: String(error) });
      }

      const roundNumber = dealRoom.currentRound + 1;

      // Create negotiation round
      await ctx.prisma.negotiationRound.create({
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

        // Get dynamic bias overrides for this clause template (if available)
        const clauseDynamicBiases = allDynamicBiases[clause.clauseTemplate.id] as
          Record<string, DynamicBiasOverride> | undefined;

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
          dynamicBiases: clauseDynamicBiases,
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

      // If all clauses are already agreed (both parties chose same options),
      // set deal to AGREED; otherwise NEGOTIATING
      const allAlreadyAgreed = divergentClauses.length === 0 && suggestions.length > 0;

      await ctx.prisma.dealRoom.update({
        where: { id: input.dealRoomId },
        data: {
          currentRound: roundNumber,
          status: allAlreadyAgreed ? DealRoomStatus.AGREED : DealRoomStatus.NEGOTIATING,
        },
      });

      // Update party statuses
      await ctx.prisma.dealRoomParty.updateMany({
        where: {
          dealRoomId: input.dealRoomId,
        },
        data: {
          status: allAlreadyAgreed ? PartyStatus.ACCEPTED : PartyStatus.REVIEWING,
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

      // Run cross-clause validation via Cloud Intelligence API (degrades to empty)
      let validation: ValidationResult = { conflicts: [], validated: false };
      try {
        const agreedClauses = suggestions
          .filter((s) => s.agreed)
          .map((s) => ({
            clauseId: s.clauseId,
            optionId: s.suggestedOptionId,
            optionLabel: "",
          }));
        if (agreedClauses.length > 0) {
          validation = await cloudApi.validateCompliance({
            contractType: dealRoom.contractTemplate?.contractType || "",
            jurisdiction: dealRoom.governingLaw,
            clauses: agreedClauses,
          });
        }
      } catch (error) {
        logger.error("Cross-clause validation failed", { err: String(error) });
      }

      return { roundNumber, suggestions, validation };
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

  // Get full negotiation history for a deal room (all rounds, suggestions, counter-proposals)
  getHistory: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: { parties: true },
      });

      if (!dealRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deal room not found" });
      }

      const party = dealRoom.parties.find((p) => p.userId === userId);
      if (!party) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const isInitiator = party.role === PartyRole.INITIATOR;

      // Fetch all rounds with counter-proposals
      const rounds = await ctx.prisma.negotiationRound.findMany({
        where: { dealRoomId: input.dealRoomId },
        include: {
          counterProposals: {
            include: {
              party: true,
              proposedOption: true,
              dealRoomClause: { include: { clauseTemplate: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { roundNumber: "asc" },
      });

      // Fetch all suggestions (all rounds, not just latest)
      const suggestions = await ctx.prisma.compromiseSuggestion.findMany({
        where: {
          dealRoomClause: { dealRoomId: input.dealRoomId },
        },
        include: {
          suggestedOption: true,
          dealRoomClause: { include: { clauseTemplate: true } },
        },
        orderBy: [
          { roundNumber: "asc" },
          { dealRoomClause: { clauseTemplate: { order: "asc" } } },
        ],
      });

      // Fetch parameter proposals
      const parameterProposals = await ctx.prisma.parameterProposal.findMany({
        where: { dealRoomId: input.dealRoomId },
        include: { party: true, round: true },
        orderBy: { createdAt: "asc" },
      });

      // Build timeline events
      const events: Array<{
        type: "compromise_generated" | "compromise_accepted" | "compromise_rejected" | "counter_proposal" | "counter_accepted" | "counter_rejected" | "parameter_proposed" | "parameter_accepted" | "parameter_rejected";
        roundNumber: number;
        clauseId: string;
        clauseTitle: string;
        party: "you" | "them";
        optionLabel?: string;
        rationale?: string | null;
        satisfactionYou?: number;
        satisfactionThem?: number;
        parameterId?: string;
        parameterFrom?: string;
        parameterTo?: string;
        createdAt: Date;
      }> = [];

      for (const round of rounds) {
        // Add suggestion events for this round
        const roundSuggestions = suggestions.filter((s) => s.roundNumber === round.roundNumber);
        for (const s of roundSuggestions) {
          events.push({
            type: "compromise_generated",
            roundNumber: round.roundNumber,
            clauseId: s.dealRoomClauseId,
            clauseTitle: s.dealRoomClause.clauseTemplate.title,
            party: "you", // system event
            optionLabel: s.suggestedOption.label,
            satisfactionYou: isInitiator ? s.satisfactionPartyA : s.satisfactionPartyB,
            satisfactionThem: isInitiator ? s.satisfactionPartyB : s.satisfactionPartyA,
            createdAt: s.createdAt,
          });

          // Acceptance/rejection events
          if (s.partyAAccepted === true) {
            events.push({
              type: "compromise_accepted",
              roundNumber: round.roundNumber,
              clauseId: s.dealRoomClauseId,
              clauseTitle: s.dealRoomClause.clauseTemplate.title,
              party: isInitiator ? "you" : "them",
              optionLabel: s.suggestedOption.label,
              createdAt: s.createdAt,
            });
          } else if (s.partyAAccepted === false) {
            events.push({
              type: "compromise_rejected",
              roundNumber: round.roundNumber,
              clauseId: s.dealRoomClauseId,
              clauseTitle: s.dealRoomClause.clauseTemplate.title,
              party: isInitiator ? "you" : "them",
              optionLabel: s.suggestedOption.label,
              createdAt: s.createdAt,
            });
          }
          if (s.partyBAccepted === true) {
            events.push({
              type: "compromise_accepted",
              roundNumber: round.roundNumber,
              clauseId: s.dealRoomClauseId,
              clauseTitle: s.dealRoomClause.clauseTemplate.title,
              party: isInitiator ? "them" : "you",
              optionLabel: s.suggestedOption.label,
              createdAt: s.createdAt,
            });
          } else if (s.partyBAccepted === false) {
            events.push({
              type: "compromise_rejected",
              roundNumber: round.roundNumber,
              clauseId: s.dealRoomClauseId,
              clauseTitle: s.dealRoomClause.clauseTemplate.title,
              party: isInitiator ? "them" : "you",
              optionLabel: s.suggestedOption.label,
              createdAt: s.createdAt,
            });
          }
        }

        // Counter-proposal events
        for (const cp of round.counterProposals) {
          const isFromMe = cp.partyId === party.id;
          events.push({
            type: "counter_proposal",
            roundNumber: round.roundNumber,
            clauseId: cp.dealRoomClauseId,
            clauseTitle: cp.dealRoomClause.clauseTemplate.title,
            party: isFromMe ? "you" : "them",
            optionLabel: cp.proposedOption.label,
            rationale: cp.rationale,
            createdAt: cp.createdAt,
          });

          if (cp.status === "ACCEPTED") {
            events.push({
              type: "counter_accepted",
              roundNumber: round.roundNumber,
              clauseId: cp.dealRoomClauseId,
              clauseTitle: cp.dealRoomClause.clauseTemplate.title,
              party: isFromMe ? "them" : "you",
              optionLabel: cp.proposedOption.label,
              createdAt: cp.createdAt,
            });
          } else if (cp.status === "REJECTED") {
            events.push({
              type: "counter_rejected",
              roundNumber: round.roundNumber,
              clauseId: cp.dealRoomClauseId,
              clauseTitle: cp.dealRoomClause.clauseTemplate.title,
              party: isFromMe ? "them" : "you",
              optionLabel: cp.proposedOption.label,
              createdAt: cp.createdAt,
            });
          }
        }
      }

      // Parameter proposal events
      for (const pp of parameterProposals) {
        const isFromMe = pp.partyId === party.id;
        events.push({
          type: "parameter_proposed",
          roundNumber: pp.round.roundNumber,
          clauseId: "", // not clause-specific
          clauseTitle: pp.parameterId,
          party: isFromMe ? "you" : "them",
          rationale: pp.rationale,
          parameterId: pp.parameterId,
          parameterFrom: pp.currentValue,
          parameterTo: pp.proposedValue,
          createdAt: pp.createdAt,
        });

        if (pp.status === "ACCEPTED") {
          events.push({
            type: "parameter_accepted",
            roundNumber: pp.round.roundNumber,
            clauseId: "",
            clauseTitle: pp.parameterId,
            party: isFromMe ? "them" : "you",
            parameterId: pp.parameterId,
            parameterFrom: pp.currentValue,
            parameterTo: pp.proposedValue,
            createdAt: pp.createdAt,
          });
        } else if (pp.status === "REJECTED") {
          events.push({
            type: "parameter_rejected",
            roundNumber: pp.round.roundNumber,
            clauseId: "",
            clauseTitle: pp.parameterId,
            party: isFromMe ? "them" : "you",
            parameterId: pp.parameterId,
            parameterFrom: pp.currentValue,
            parameterTo: pp.proposedValue,
            createdAt: pp.createdAt,
          });
        }
      }

      // Sort by time
      events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      return {
        currentRound: dealRoom.currentRound,
        events,
      };
    }),

  // Get quality scores for clause options (from Cloud Intelligence API)
  getQualityScores: protectedProcedure
    .input(
      z.object({
        dealRoomId: z.string(),
        clauseTemplateId: z.string(),
        optionIds: z.array(z.string()),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: {
          contractTemplate: true,
          parties: true,
        },
      });

      if (!dealRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deal room not found" });
      }

      const party = dealRoom.parties.find((p) => p.userId === userId);
      if (!party) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      return cloudApi.scoreClauseQuality(
        dealRoom.contractTemplate?.contractType || "",
        dealRoom.governingLaw,
        input.clauseTemplateId,
        input.optionIds
      );
    }),

  // Cross-clause conflict validation via Cloud Intelligence API
  getValidation: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: {
          contractTemplate: true,
          parties: true,
          clauses: {
            where: { status: "AGREED" },
            include: {
              clauseTemplate: true,
            },
          },
        },
      });

      if (!dealRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deal room not found" });
      }

      const party = dealRoom.parties.find((p) => p.userId === userId);
      if (!party) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      if (dealRoom.clauses.length === 0) {
        return { conflicts: [], validated: false } as ValidationResult;
      }

      return cloudApi.validateCompliance({
        contractType: dealRoom.contractTemplate?.contractType || "",
        jurisdiction: dealRoom.governingLaw,
        clauses: dealRoom.clauses.map((c) => ({
          clauseId: c.clauseTemplate.clauseId,
          optionId: c.agreedOptionId || "",
          optionLabel: "",
        })),
      });
    }),

  // Satisfaction prediction via Cloud Intelligence API
  predictSatisfaction: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: {
          contractTemplate: true,
          parties: true,
          clauses: {
            include: {
              clauseTemplate: {
                include: { options: true },
              },
              selections: true,
            },
          },
        },
      });

      if (!dealRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deal room not found" });
      }

      const party = dealRoom.parties.find((p) => p.userId === userId);
      if (!party) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const initiator = dealRoom.parties.find((p) => p.role === "INITIATOR");
      const respondent = dealRoom.parties.find((p) => p.role === "RESPONDENT");
      if (!initiator || !respondent) {
        return { predictedSatisfactionA: 0, predictedSatisfactionB: 0, confidence: 0, predicted: false };
      }

      const selections = dealRoom.clauses
        .map((clause) => {
          const selA = clause.selections.find((s) => s.partyId === initiator.id);
          const selB = clause.selections.find((s) => s.partyId === respondent.id);
          if (!selA || !selB) return null;
          return {
            clauseId: clause.clauseTemplate.clauseId,
            partyAOptionId: selA.optionId,
            partyBOptionId: selB.optionId,
            partyAPriority: selA.priority,
            partyBPriority: selB.priority,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      if (selections.length === 0) {
        return { predictedSatisfactionA: 0, predictedSatisfactionB: 0, confidence: 0, predicted: false };
      }

      return cloudApi.predictSatisfaction({
        contractType: dealRoom.contractTemplate?.contractType || "",
        jurisdiction: dealRoom.governingLaw,
        selections,
      });
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

      assertMutableStatus(clause.dealRoom.status);

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

      // Calculate average satisfaction (equal weight per clause)
      const initiator = dealRoom.parties.find((p) => p.role === PartyRole.INITIATOR);
      const respondent = dealRoom.parties.find((p) => p.role === PartyRole.RESPONDENT);

      let clauseCount = 0;
      let totalSatisfactionA = 0;
      let totalSatisfactionB = 0;
      let gotPreferenceA = 0;
      let gotPreferenceB = 0;
      let firmClausesA = 0;
      let firmClausesB = 0;
      let openClausesA = 0;
      let openClausesB = 0;

      for (const clause of dealRoom.clauses) {
        const suggestion = clause.compromiseSuggestions[0];
        if (!suggestion) continue;

        clauseCount++;
        totalSatisfactionA += suggestion.satisfactionPartyA;
        totalSatisfactionB += suggestion.satisfactionPartyB;

        const selectionA = clause.selections.find(
          (s) => s.partyId === initiator?.id
        );
        const selectionB = clause.selections.find(
          (s) => s.partyId === respondent?.id
        );

        // Count clauses where party got their preferred option
        if (selectionA && suggestion.suggestedOptionId === selectionA.optionId) gotPreferenceA++;
        if (selectionB && suggestion.suggestedOptionId === selectionB.optionId) gotPreferenceB++;

        // Count firm (flexibility <= 2) vs open (flexibility >= 4) clauses
        if (selectionA) {
          if (selectionA.flexibility <= 2) firmClausesA++;
          if (selectionA.flexibility >= 4) openClausesA++;
        }
        if (selectionB) {
          if (selectionB.flexibility <= 2) firmClausesB++;
          if (selectionB.flexibility >= 4) openClausesB++;
        }
      }

      return {
        partyA: {
          name: initiator?.name || initiator?.email || "Party A",
          satisfaction:
            clauseCount > 0
              ? Math.round(totalSatisfactionA / clauseCount)
              : 0,
          gotPreference: gotPreferenceA,
          firmClauses: firmClausesA,
          openClauses: openClausesA,
        },
        partyB: {
          name: respondent?.name || respondent?.email || "Party B",
          satisfaction:
            clauseCount > 0
              ? Math.round(totalSatisfactionB / clauseCount)
              : 0,
          gotPreference: gotPreferenceB,
          firmClauses: firmClausesB,
          openClauses: openClausesB,
        },
        totalClauses: clauseCount,
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

      assertMutableStatus(clause.dealRoom.status);

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

      assertMutableStatus(counterProposal.dealRoomClause.dealRoom.status);

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

      assertMutableStatus(dealRoom.status);

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
      await ctx.prisma.negotiationRound.create({
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

  // ── Parameter Proposals ─────────────────────────────────

  // Get negotiable parameters and any proposals for the current deal
  getParameterProposals: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: {
          contractTemplate: true,
          parties: true,
          parameterProposals: {
            include: { party: true },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!dealRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deal room not found" });
      }

      const party = dealRoom.parties.find((p) => p.userId === userId);
      if (!party) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Extract negotiable parameters from skill's parameterSchema
      const schema = dealRoom.contractTemplate.parameterSchema as { parameters?: Array<{ id: string; token: string; type: string; label: string | Record<string, string>; negotiable?: boolean; scope: string }> } | null;
      const negotiableParams = schema?.parameters?.filter((p) => p.negotiable) || [];

      const dealParams = (dealRoom.parameters || {}) as Record<string, string>;

      // Build response: each negotiable param with its current value and any proposals
      const parameters = negotiableParams.map((param) => {
        const proposals = dealRoom.parameterProposals.filter(
          (pp) => pp.parameterId === param.id
        );
        const pendingForMe = proposals.filter(
          (pp) => pp.partyId !== party.id && pp.status === "PENDING"
        );
        const myProposals = proposals.filter(
          (pp) => pp.partyId === party.id
        );

        return {
          id: param.id,
          token: param.token,
          type: param.type,
          label: param.label,
          scope: param.scope,
          currentValue: dealParams[param.id] || "",
          pendingForMe,
          myProposals,
          allProposals: proposals,
        };
      });

      return { parameters };
    }),

  // Submit a parameter change proposal
  proposeParameterChange: protectedProcedure
    .input(
      z.object({
        dealRoomId: z.string(),
        parameterId: z.string(),
        proposedValue: z.string().min(1),
        rationale: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        include: {
          contractTemplate: true,
          parties: true,
          rounds: { orderBy: { roundNumber: "desc" }, take: 1 },
        },
      });

      if (!dealRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deal room not found" });
      }

      assertMutableStatus(dealRoom.status);

      const party = dealRoom.parties.find((p) => p.userId === userId);
      if (!party) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Verify the parameter is negotiable
      const schema = dealRoom.contractTemplate.parameterSchema as { parameters?: Array<{ id: string; negotiable?: boolean }> } | null;
      const paramDef = schema?.parameters?.find((p) => p.id === input.parameterId);
      if (!paramDef?.negotiable) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This parameter is not negotiable" });
      }

      const dealParams = (dealRoom.parameters || {}) as Record<string, string>;
      const currentValue = dealParams[input.parameterId] || "";

      // Must have an active round (parameter proposals are per-round)
      let round = dealRoom.rounds[0];
      if (!round) {
        // Create a round if none exists (e.g. first time proposing after initial compromise)
        round = await ctx.prisma.negotiationRound.create({
          data: {
            dealRoomId: input.dealRoomId,
            roundNumber: dealRoom.currentRound || 1,
            initiatedBy: party.role,
          },
        });
      }

      // Create the proposal (upsert: one proposal per param per party per round)
      const proposal = await ctx.prisma.parameterProposal.upsert({
        where: {
          roundId_parameterId_partyId: {
            roundId: round.id,
            parameterId: input.parameterId,
            partyId: party.id,
          },
        },
        create: {
          dealRoomId: input.dealRoomId,
          roundId: round.id,
          partyId: party.id,
          parameterId: input.parameterId,
          currentValue,
          proposedValue: input.proposedValue,
          rationale: input.rationale || null,
        },
        update: {
          proposedValue: input.proposedValue,
          rationale: input.rationale || null,
          status: "PENDING",
        },
      });

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: input.dealRoomId,
          userId,
          action: "PARAMETER_PROPOSAL_SUBMITTED",
          details: {
            parameterId: input.parameterId,
            currentValue,
            proposedValue: input.proposedValue,
          },
        },
      });

      return proposal;
    }),

  // Respond to a parameter change proposal (accept or reject)
  respondToParameterProposal: protectedProcedure
    .input(
      z.object({
        proposalId: z.string(),
        accept: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const proposal = await ctx.prisma.parameterProposal.findUnique({
        where: { id: input.proposalId },
        include: {
          dealRoom: { include: { parties: true } },
          party: true,
        },
      });

      if (!proposal) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
      }

      assertMutableStatus(proposal.dealRoom.status);

      const myParty = proposal.dealRoom.parties.find((p) => p.userId === userId);
      if (!myParty) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Can't respond to your own proposal
      if (proposal.partyId === myParty.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot respond to your own proposal" });
      }

      if (proposal.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal is no longer pending" });
      }

      const newStatus = input.accept ? "ACCEPTED" : "REJECTED";

      await ctx.prisma.parameterProposal.update({
        where: { id: input.proposalId },
        data: { status: newStatus },
      });

      // If accepted, update the deal's parameter value
      if (input.accept) {
        const currentParams = (proposal.dealRoom.parameters || {}) as Record<string, string>;
        currentParams[proposal.parameterId] = proposal.proposedValue;

        await ctx.prisma.dealRoom.update({
          where: { id: proposal.dealRoomId },
          data: { parameters: currentParams },
        });
      }

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: proposal.dealRoomId,
          userId,
          action: input.accept ? "PARAMETER_PROPOSAL_ACCEPTED" : "PARAMETER_PROPOSAL_REJECTED",
          details: {
            parameterId: proposal.parameterId,
            proposedValue: proposal.proposedValue,
          },
        },
      });

      return { accepted: input.accept };
    }),
});
