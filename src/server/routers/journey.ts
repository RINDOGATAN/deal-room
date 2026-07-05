/**
 * Journey router — guided Startup Quick Start experience.
 *
 * A StartupJourney bundles multiple generated deals (Cert of Inc, Founders' RSPAs,
 * IP Assignments, etc.) under a shared company + founder profile so founders don't
 * have to re-enter the same data across 8–12 documents.
 *
 * MVP scope: Delaware C-Corp, Foundation step only. Later increments add Equity Pool,
 * Hiring, and Raise steps.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  Prisma,
  ClauseStatus,
  DealMode,
  DealRoomStatus,
  GoverningLaw,
  PartyRole,
  PartyStatus,
  StartupJourneyStatus,
  UserRole,
} from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { getStepPlan, type StepKey } from "@/lib/journey/steps";
import { validateEquity } from "@/lib/journey/equity";
import { autoAgreeSingleOptionClauses } from "../services/deal/autoAgreeSingleOption";
import { createLogger } from "@/lib/logger";

const logger = createLogger("journey");

const founderInput = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  title: z.string().max(120).optional(),
  equityPercent: z.number().min(0).max(100).optional(),
  isIncorporator: z.boolean().default(false),
  isPrimary: z.boolean().default(false),
});

const foundersArrayInput = z
  .array(founderInput)
  .min(1)
  .max(6)
  .superRefine((founders, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < founders.length; i++) {
      const email = founders[i].email.trim().toLowerCase();
      if (seen.has(email)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "email"],
          message: "Duplicate founder email",
        });
      }
      seen.add(email);
    }

    const equity = validateEquity(founders);
    if (!equity.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["equityPercent"],
        message:
          equity.reason === "PARTIAL_EQUITY"
            ? `Either every founder needs an equity %, or none do. Current total: ${equity.total}%`
            : `Founder equity must sum to 100%. Current total: ${equity.total}%`,
      });
    }
  });

export const journeyRouter = createTRPCRouter({
  // Create a new journey with company profile + founders
  create: protectedProcedure
    .input(
      z.object({
        companyName: z.string().min(1).max(200),
        companyAddress: z.string().max(500).optional(),
        state: z.string().default("DELAWARE"),
        entityType: z.string().default("C_CORP"),
        authorizedShares: z.number().int().positive().default(10_000_000),
        optionPoolPercent: z.number().min(0).max(50).optional(),
        founders: foundersArrayInput,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Require exactly one primary founder (default to first if none flagged)
      const hasPrimary = input.founders.some((f) => f.isPrimary);
      const founders = input.founders.map((f, i) => ({
        ...f,
        isPrimary: hasPrimary ? f.isPrimary : i === 0,
      }));

      const journey = await ctx.prisma.startupJourney.create({
        data: {
          userId,
          companyName: input.companyName,
          companyAddress: input.companyAddress,
          state: input.state,
          entityType: input.entityType,
          authorizedShares: input.authorizedShares,
          optionPoolPercent: input.optionPoolPercent
            ? new Prisma.Decimal(input.optionPoolPercent)
            : null,
          founders: {
            create: founders.map((f) => ({
              name: f.name,
              email: f.email,
              title: f.title,
              equityPercent: f.equityPercent != null ? new Prisma.Decimal(f.equityPercent) : null,
              isIncorporator: f.isIncorporator,
              isPrimary: f.isPrimary,
            })),
          },
        },
        include: { founders: true, dealRooms: true },
      });

      // Creating a journey is a strong self-identification as a startup owner.
      // Set the user role now so downstream pages (e.g. /deals/[id] for a
      // journey-generated deal) don't blindside the founder with the
      // business-vs-lawyer onboarding modal.
      const currentUser = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!currentUser?.role) {
        await ctx.prisma.user.update({
          where: { id: userId },
          data: { role: UserRole.BUSINESS_OWNER, onboardedAt: new Date() },
        });
      }

      return journey;
    }),

  // Fetch a journey with founders and generated deals
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const journey = await ctx.prisma.startupJourney.findFirst({
        where: { id: input.id, userId },
        include: {
          founders: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
          dealRooms: {
            select: {
              id: true,
              name: true,
              status: true,
              contractTemplate: { select: { contractType: true, displayName: true } },
              journeyStepKey: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!journey) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Journey not found" });
      }
      return journey;
    }),

  // List current user's journeys
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return ctx.prisma.startupJourney.findMany({
      where: { userId },
      include: { founders: true, _count: { select: { dealRooms: true } } },
      orderBy: { updatedAt: "desc" },
    });
  }),

  // Update core company profile fields
  updateCompany: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        companyName: z.string().min(1).max(200).optional(),
        companyAddress: z.string().max(500).optional(),
        authorizedShares: z.number().int().positive().optional(),
        optionPoolPercent: z.number().min(0).max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await ctx.prisma.startupJourney.findFirst({
        where: { id: input.id, userId },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Journey not found" });
      }
      return ctx.prisma.startupJourney.update({
        where: { id: input.id },
        data: {
          companyName: input.companyName,
          companyAddress: input.companyAddress,
          authorizedShares: input.authorizedShares,
          optionPoolPercent:
            input.optionPoolPercent != null
              ? new Prisma.Decimal(input.optionPoolPercent)
              : undefined,
        },
      });
    }),

  // Add a founder
  addFounder: protectedProcedure
    .input(
      z.object({
        journeyId: z.string(),
        founder: founderInput,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const journey = await ctx.prisma.startupJourney.findFirst({
        where: { id: input.journeyId, userId },
        include: { founders: true },
      });
      if (!journey) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Journey not found" });
      }
      if (journey.founders.length >= 6) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum 6 founders" });
      }
      return ctx.prisma.journeyFounder.create({
        data: {
          journeyId: journey.id,
          name: input.founder.name,
          email: input.founder.email,
          title: input.founder.title,
          equityPercent:
            input.founder.equityPercent != null
              ? new Prisma.Decimal(input.founder.equityPercent)
              : null,
          isIncorporator: input.founder.isIncorporator,
          isPrimary: input.founder.isPrimary,
        },
      });
    }),

  // Remove a founder (only if journey not completed)
  removeFounder: protectedProcedure
    .input(z.object({ journeyId: z.string(), founderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const journey = await ctx.prisma.startupJourney.findFirst({
        where: { id: input.journeyId, userId },
        include: { founders: true },
      });
      if (!journey) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Journey not found" });
      }
      if (journey.founders.length <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A journey needs at least one founder",
        });
      }
      await ctx.prisma.journeyFounder.delete({ where: { id: input.founderId } });
      return { success: true };
    }),

  /**
   * Generate all deals for a given step. Reads the step plan from `src/lib/journey/steps.ts`,
   * which maps founder-facing business answers to {skill, clauseSelections, parameters}
   * tuples. For MVP (Foundation step) this produces a Cert of Inc plus, per founder, a
   * Founders' Agreement and an IP Assignment.
   */
  generateStep: protectedProcedure
    .input(
      z.object({
        journeyId: z.string(),
        stepKey: z.string(),
        answers: z.record(z.string(), z.string()).default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const userEmail = ctx.session.user.email!;
      const userName = ctx.session.user.name;

      const journey = await ctx.prisma.startupJourney.findFirst({
        where: { id: input.journeyId, userId },
        include: { founders: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
      });
      if (!journey) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Journey not found" });
      }

      const plan = getStepPlan(input.stepKey as StepKey, journey, input.answers);
      if (!plan.deals.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No deals to generate for this step with the given answers",
        });
      }

      const createdDeals: { id: string; contractType: string; name: string }[] = [];

      for (const d of plan.deals) {
        const template = await ctx.prisma.contractTemplate.findUnique({
          where: { contractType: d.contractType },
          include: {
            clauses: {
              orderBy: { order: "asc" },
              include: { options: { orderBy: { order: "asc" } } },
            },
          },
        });
        if (!template) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Skill '${d.contractType}' not found. Run 'npx prisma db seed' to ensure it is installed.`,
          });
        }

        const deal = await ctx.prisma.dealRoom.create({
          data: {
            name: d.name,
            contractTemplateId: template.id,
            dealMode: DealMode.SOLO,
            governingLaw: GoverningLaw.CALIFORNIA, // US-pragmatic default; skill content handles Delaware specifics
            contractLanguage: "en",
            parameters: Object.keys(d.parameters).length
              ? (d.parameters as Prisma.InputJsonValue)
              : Prisma.DbNull,
            status: DealRoomStatus.DRAFT,
            journeyId: journey.id,
            journeyStepKey: input.stepKey,
            parties: {
              create: {
                userId,
                role: PartyRole.INITIATOR,
                status: PartyStatus.PENDING,
                email: userEmail,
                name: userName,
                company: journey.companyName,
              },
            },
            clauses: {
              create: template.clauses.map((clause) => ({
                clauseTemplateId: clause.id,
                status: ClauseStatus.PENDING,
              })),
            },
          },
          include: { parties: true, clauses: true },
        });

        // Auto-select clauses that have only one option (no real choice to make).
        // Shared helper with deal.create so the behavior is identical whether
        // the deal arrives via /launch or via /deals/new.
        const party = deal.parties[0];
        let autoAgreed = false;
        if (party) {
          const res = await autoAgreeSingleOptionClauses(ctx.prisma, {
            dealRoomId: deal.id,
            dealMode: DealMode.SOLO,
            partyId: party.id,
            templateClauses: template.clauses,
            dealClauses: deal.clauses,
          });
          autoAgreed = res.autoAgreed;
        }

        await ctx.prisma.auditLog.create({
          data: {
            dealRoomId: deal.id,
            userId,
            action: "JOURNEY_DEAL_GENERATED",
            details: {
              journeyId: journey.id,
              stepKey: input.stepKey,
              contractType: d.contractType,
              autoAgreed,
            },
          },
        });

        createdDeals.push({ id: deal.id, contractType: d.contractType, name: d.name });
      }

      // Update step status on the journey
      const currentSteps = (journey.stepStatuses as Record<string, unknown>) ?? {};
      const updatedSteps = {
        ...currentSteps,
        [input.stepKey]: {
          status: "READY_FOR_REVIEW",
          completedAt: new Date().toISOString(),
          answers: input.answers,
          dealIds: createdDeals.map((d) => d.id),
        },
      };
      await ctx.prisma.startupJourney.update({
        where: { id: journey.id },
        data: { stepStatuses: updatedSteps as Prisma.InputJsonValue },
      });

      return { deals: createdDeals, stepKey: input.stepKey };
    }),

  /**
   * Request lawyer review of every deal in a step by batching Stage A requests.
   * Returns counts of successful + failed assignments. Deals already under review
   * are skipped quietly.
   */
  requestStepReview: protectedProcedure
    .input(
      z.object({
        journeyId: z.string(),
        stepKey: z.string(),
        supervisorId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const journey = await ctx.prisma.startupJourney.findFirst({
        where: { id: input.journeyId, userId },
        include: {
          dealRooms: {
            where: { journeyStepKey: input.stepKey },
            include: { parties: true },
          },
        },
      });
      if (!journey) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Journey not found" });
      }

      const supervisor = await ctx.prisma.supervisor.findUnique({
        where: { id: input.supervisorId },
      });
      if (!supervisor || !supervisor.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected attorney is not available",
        });
      }

      const results: { dealId: string; status: "assigned" | "skipped" | "error"; reason?: string }[] = [];

      for (const deal of journey.dealRooms) {
        const party = deal.parties.find((p) => p.userId === userId);
        if (!party) {
          results.push({ dealId: deal.id, status: "error", reason: "not a party" });
          continue;
        }
        if (party.attorneyReviewRequested) {
          results.push({ dealId: deal.id, status: "skipped", reason: "already requested" });
          continue;
        }

        await ctx.prisma.dealRoomParty.update({
          where: { id: party.id },
          data: {
            attorneyReviewRequested: true,
            attorneyReviewRequestedAt: new Date(),
            attorneySupervisorId: supervisor.id,
          },
        });
        await ctx.prisma.supervisorAssignment.upsert({
          where: {
            supervisorId_dealRoomId: {
              supervisorId: supervisor.id,
              dealRoomId: deal.id,
            },
          },
          create: {
            dealRoomId: deal.id,
            supervisorId: supervisor.id,
            assignedBy: null,
          },
          update: {},
        });
        await ctx.prisma.auditLog.create({
          data: {
            dealRoomId: deal.id,
            userId,
            action: "JOURNEY_STEP_REVIEW_REQUESTED",
            details: {
              journeyId: journey.id,
              stepKey: input.stepKey,
              supervisorId: supervisor.id,
            },
          },
        });
        results.push({ dealId: deal.id, status: "assigned" });
      }

      // Persist supervisorId into step status
      const currentSteps = journey.stepStatuses as Record<
        string,
        Record<string, unknown>
      > | null;
      const previous = currentSteps?.[input.stepKey] ?? {};
      const updatedSteps = {
        ...(currentSteps ?? {}),
        [input.stepKey]: {
          ...previous,
          status: "AWAITING_REVIEW",
          supervisorId: supervisor.id,
          reviewRequestedAt: new Date().toISOString(),
        },
      };
      await ctx.prisma.startupJourney.update({
        where: { id: journey.id },
        data: { stepStatuses: updatedSteps as Prisma.InputJsonValue },
      });

      return { results };
    }),

  /**
   * Mark a step as already done outside Dealroom. Flips its status to
   * DONE_ELSEWHERE so the hub stops offering to generate deals for it and
   * the dependency-unlock logic treats it as advanced-enough to open later
   * steps. Guards against overriding a step that already has generated deals.
   */
  markStepDoneElsewhere: protectedProcedure
    .input(
      z.object({
        journeyId: z.string(),
        stepKey: z.string(),
        note: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const journey = await ctx.prisma.startupJourney.findFirst({
        where: { id: input.journeyId, userId },
        include: {
          dealRooms: {
            where: { journeyStepKey: input.stepKey },
            select: { id: true },
          },
        },
      });
      if (!journey) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Journey not found" });
      }
      if (journey.dealRooms.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This step already has generated documents; cancel those first if you really meant to mark the step as done elsewhere.",
        });
      }

      const currentSteps = (journey.stepStatuses as Record<string, unknown>) ?? {};
      const updatedSteps = {
        ...currentSteps,
        [input.stepKey]: {
          status: "DONE_ELSEWHERE",
          markedDoneAt: new Date().toISOString(),
          ...(input.note ? { note: input.note } : {}),
        },
      };
      await ctx.prisma.startupJourney.update({
        where: { id: journey.id },
        data: { stepStatuses: updatedSteps as Prisma.InputJsonValue },
      });

      // Audit log — attached to the journey owner's earliest deal if any, otherwise
      // captured without a dealRoomId (auditLog.dealRoomId is required, so for
      // steps with no deals we skip the DB audit and log via the app logger).
      // Since we've already guarded that no deals exist, a log line is fine here.
      logger.info("JOURNEY_STEP_MARKED_DONE_ELSEWHERE", {
        journeyId: journey.id,
        stepKey: input.stepKey,
        userId,
      });

      return { success: true };
    }),

  /** Revert a DONE_ELSEWHERE step back to NOT_STARTED. */
  resetStepStatus: protectedProcedure
    .input(z.object({ journeyId: z.string(), stepKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const journey = await ctx.prisma.startupJourney.findFirst({
        where: { id: input.journeyId, userId },
        include: {
          dealRooms: {
            where: { journeyStepKey: input.stepKey },
            select: { id: true },
          },
        },
      });
      if (!journey) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Journey not found" });
      }
      if (journey.dealRooms.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This step has generated documents; resetting is not allowed while they exist.",
        });
      }
      const currentSteps =
        (journey.stepStatuses as Record<string, Record<string, unknown>>) ?? {};
      const currentStatus = currentSteps[input.stepKey]?.status;
      if (currentStatus !== "DONE_ELSEWHERE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only steps marked done-elsewhere can be reset.",
        });
      }
      const updatedSteps = {
        ...currentSteps,
        [input.stepKey]: { status: "NOT_STARTED" },
      };
      await ctx.prisma.startupJourney.update({
        where: { id: journey.id },
        data: { stepStatuses: updatedSteps as Prisma.InputJsonValue },
      });
      return { success: true };
    }),

  // Mark a step as filed (e.g., Cert of Inc filed with Delaware)
  markStepFiled: protectedProcedure
    .input(z.object({ journeyId: z.string(), stepKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const journey = await ctx.prisma.startupJourney.findFirst({
        where: { id: input.journeyId, userId },
      });
      if (!journey) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Journey not found" });
      }
      const currentSteps =
        (journey.stepStatuses as Record<string, Record<string, unknown>>) ?? {};
      const previous = currentSteps[input.stepKey] ?? {};
      const updatedSteps = {
        ...currentSteps,
        [input.stepKey]: {
          ...previous,
          status: "FILED",
          filedAt: new Date().toISOString(),
        },
      };
      return ctx.prisma.startupJourney.update({
        where: { id: journey.id },
        data: { stepStatuses: updatedSteps as Prisma.InputJsonValue },
      });
    }),

  // Abandon a journey
  abandon: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const journey = await ctx.prisma.startupJourney.findFirst({
        where: { id: input.id, userId },
      });
      if (!journey) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Journey not found" });
      }
      return ctx.prisma.startupJourney.update({
        where: { id: input.id },
        data: { status: StartupJourneyStatus.ABANDONED },
      });
    }),
});
