// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { Prisma, DealRoomStatus, DealMode, PartyRole, PartyStatus, ClauseStatus, InvitationStatus, GoverningLaw } from "@prisma/client";
import { checkDealCreationEntitlement } from "../services/licensing/entitlement";
import { resolveLocalizedString, resolveLocalizedArray } from "../services/skills/i18n";
import { validateRequiredParameters, type ParameterSchema } from "@/lib/parameters";
import { governingLawForSkillJurisdiction } from "@/lib/jurisdictions";
import { autoAgreeSingleOptionClauses } from "../services/deal/autoAgreeSingleOption";
import { features } from "@/config/features";

// Map GoverningLaw enum to jurisdiction strings for entitlement checking
const GOVERNING_LAW_TO_JURISDICTION: Record<string, string> = {
  CALIFORNIA: "CALIFORNIA",
  ENGLAND_WALES: "ENGLAND_WALES",
  SPAIN: "SPAIN",
};

export const dealRouter = createTRPCRouter({
  // Get parameter schema for a contract type (used by deal creation wizard)
  getParameterSchema: protectedProcedure
    .input(z.object({ contractType: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.prisma.contractTemplate.findUnique({
        where: { contractType: input.contractType },
        select: { parameterSchema: true },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contract template not found",
        });
      }

      return template.parameterSchema as ParameterSchema | null;
    }),

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
        // Hide cancelled deals from the list
        status: {
          not: DealRoomStatus.CANCELLED,
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
        invitations: {
          where: { status: InvitationStatus.PENDING },
          orderBy: { sentAt: "desc" },
          take: 1,
          select: {
            id: true,
            email: true,
            sentAt: true,
            expiresAt: true,
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
          lawyerVetting: {
            select: {
              id: true,
              status: true,
              approvedAt: true,
              lawyer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
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

      // Resolve i18n content if contract language is not English
      const lang = dealRoom.contractLanguage;
      if (lang && lang !== "en") {
        for (const clause of dealRoom.clauses) {
          const ct = clause.clauseTemplate;
          const ctLocalized = ct.localizedContent as Record<string, Record<string, string>> | null;
          if (ctLocalized) {
            if (ctLocalized.title) (ct as any).title = resolveLocalizedString(ctLocalized.title, lang);
            if (ctLocalized.category) (ct as any).category = resolveLocalizedString(ctLocalized.category, lang);
            if (ctLocalized.plainDescription) (ct as any).plainDescription = resolveLocalizedString(ctLocalized.plainDescription, lang);
            if (ctLocalized.legalContext) (ct as any).legalContext = resolveLocalizedString(ctLocalized.legalContext, lang);
          }

          for (const opt of ct.options) {
            const optLocalized = opt.localizedContent as Record<string, unknown> | null;
            if (optLocalized) {
              if (optLocalized.label) (opt as any).label = resolveLocalizedString(optLocalized.label, lang);
              if (optLocalized.plainDescription) (opt as any).plainDescription = resolveLocalizedString(optLocalized.plainDescription, lang);
              if (optLocalized.legalText) (opt as any).legalText = resolveLocalizedString(optLocalized.legalText, lang);
              if (optLocalized.prosPartyA) (opt as any).prosPartyA = resolveLocalizedArray(optLocalized.prosPartyA, lang);
              if (optLocalized.consPartyA) (opt as any).consPartyA = resolveLocalizedArray(optLocalized.consPartyA, lang);
              if (optLocalized.prosPartyB) (opt as any).prosPartyB = resolveLocalizedArray(optLocalized.prosPartyB, lang);
              if (optLocalized.consPartyB) (opt as any).consPartyB = resolveLocalizedArray(optLocalized.consPartyB, lang);
            }

            // Also resolve the option in selections (the denormalized option copy)
            for (const sel of clause.selections) {
              if (sel.option.id === opt.id) {
                const selOptLocalized = sel.option.localizedContent as Record<string, unknown> | null;
                if (selOptLocalized) {
                  if (selOptLocalized.label) (sel.option as any).label = resolveLocalizedString(selOptLocalized.label, lang);
                  if (selOptLocalized.plainDescription) (sel.option as any).plainDescription = resolveLocalizedString(selOptLocalized.plainDescription, lang);
                  if (selOptLocalized.legalText) (sel.option as any).legalText = resolveLocalizedString(selOptLocalized.legalText, lang);
                  if (selOptLocalized.prosPartyA) (sel.option as any).prosPartyA = resolveLocalizedArray(selOptLocalized.prosPartyA, lang);
                  if (selOptLocalized.consPartyA) (sel.option as any).consPartyA = resolveLocalizedArray(selOptLocalized.consPartyA, lang);
                  if (selOptLocalized.prosPartyB) (sel.option as any).prosPartyB = resolveLocalizedArray(selOptLocalized.prosPartyB, lang);
                  if (selOptLocalized.consPartyB) (sel.option as any).consPartyB = resolveLocalizedArray(selOptLocalized.consPartyB, lang);
                }
              }
            }
          }
        }
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
        contractLanguage: z.enum(["en", "es"]).default("en"),
        dealMode: z.enum(["NEGOTIATION", "SOLO"]).default("NEGOTIATION"),
        initiatorCompany: z.string().optional(),
        parameters: z.record(z.string(), z.string()).optional(),
        // Asymmetric-role contracts (DPA): which role the initiator takes. The
        // counterparty (if any) takes the other. Ignored for symmetric skills.
        fillRole: z.enum(["CONTROLLER", "PROCESSOR"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const userEmail = ctx.session.user.email!;
      const userName = ctx.session.user.name;

      // Find the contract template
      let template = await ctx.prisma.contractTemplate.findUnique({
        where: { contractType: input.contractType },
        include: {
          clauses: {
            orderBy: { order: "asc" },
            include: { options: { select: { id: true }, orderBy: { order: "asc" } } },
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

      // Auto-resolve to jurisdiction-native template if available
      if (template.templateFamily) {
        const nativeTemplate = await ctx.prisma.contractTemplate.findFirst({
          where: {
            templateFamily: template.templateFamily,
            nativeJurisdiction: input.governingLaw as any,
            isActive: true,
            id: { not: template.id }, // Don't match self
          },
          include: {
            clauses: {
              orderBy: { order: "asc" },
              include: { options: { select: { id: true }, orderBy: { order: "asc" } } },
            },
            skillPackage: true,
          },
        });

        if (nativeTemplate) {
          template = nativeTemplate;
        }
      }

      // Validate jurisdiction and language constraints. Template jurisdiction
      // tags can be more specific than the GoverningLaw enum (e.g. DELAWARE
      // runs under the US framework) — resolve them before comparing.
      const templateGoverningLaws = template.jurisdictions
        .map((j) => governingLawForSkillJurisdiction(j))
        .filter((j): j is NonNullable<typeof j> => j !== null);
      if (template.jurisdictions.length > 0 && !templateGoverningLaws.includes(input.governingLaw)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This contract template does not support the ${input.governingLaw} jurisdiction`,
        });
      }
      if (template.languages.length > 0 && !template.languages.includes(input.contractLanguage)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This contract template does not support the ${input.contractLanguage} language`,
        });
      }

      // Check entitlement if this is a licensed skill (skipped during the
      // all-skills-free promo — unlocks every premium skill platform-wide).
      if (template.skillPackageId && !features.allSkillsFree) {
        // Find customer by email
        const customer = await ctx.prisma.customer.findFirst({
          where: { email: { equals: userEmail, mode: "insensitive" } },
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

      // Validate required parameters if template has a parameter schema
      const parameterSchema = template.parameterSchema as unknown as ParameterSchema | null;
      const dealParameters: Record<string, string> = input.parameters ?? {};
      if (parameterSchema?.parameters?.length) {
        const missing = validateRequiredParameters(dealParameters, parameterSchema);
        if (missing.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Missing required parameters: ${missing.join(", ")}`,
          });
        }
      }

      // Create the deal room with clauses
      const dealRoom = await ctx.prisma.dealRoom.create({
        data: {
          name: input.name,
          contractTemplateId: template.id,
          dealMode: input.dealMode as DealMode,
          governingLaw: input.governingLaw as GoverningLaw,
          contractLanguage: input.contractLanguage,
          parameters: Object.keys(dealParameters).length > 0
            ? (dealParameters as Prisma.InputJsonValue)
            : Prisma.DbNull,
          // Persist the Controller/Processor choice for DPAs (both solo and
          // two-party); other skills have roles fixed by position so we leave it
          // null. Single source of truth read by the document generator — solo
          // leaves the other role blank, two-party swaps the counterparty into
          // it. Default Processor (the common "processor prepares the DPA" case).
          soloFillRole:
            input.contractType === "DPA"
              ? input.fillRole ?? "PROCESSOR"
              : null,
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

      // Auto-select + auto-agree any clauses with exactly one option. For
      // solo deals where every clause is single-option (e.g. the Delaware
      // Cert of Incorporation), this flips the deal to AGREED immediately
      // so the PDF is ready without a pointless 6-click wizard.
      const initiatorParty = dealRoom.parties[0];
      if (initiatorParty) {
        const { autoAgreed } = await autoAgreeSingleOptionClauses(ctx.prisma, {
          dealRoomId: dealRoom.id,
          dealMode: input.dealMode as DealMode,
          partyId: initiatorParty.id,
          templateClauses: template.clauses,
          dealClauses: dealRoom.clauses,
        });
        if (autoAgreed) {
          await ctx.prisma.auditLog.create({
            data: {
              dealRoomId: dealRoom.id,
              userId,
              action: "DEAL_ROOM_AUTO_AGREED",
              details: {
                reason: "all clauses are single-option in SOLO mode",
                clauseCount: template.clauses.length,
              },
            },
          });
        }
      }

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
            contractLanguage: input.contractLanguage,
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

      // Solo mode: auto-agree all clauses using initiator's selections
      if (dealRoom.dealMode === DealMode.SOLO) {
        for (const clause of dealRoom.clauses) {
          const selection = clause.selections.find((s) => s.partyId === party.id);
          if (selection) {
            await ctx.prisma.dealRoomClause.update({
              where: { id: clause.id },
              data: {
                status: ClauseStatus.AGREED,
                agreedOptionId: selection.optionId,
              },
            });
          }
        }

        await ctx.prisma.dealRoom.update({
          where: { id: input.dealRoomId },
          data: { status: DealRoomStatus.AGREED },
        });

        await ctx.prisma.auditLog.create({
          data: {
            dealRoomId: input.dealRoomId,
            userId,
            action: "SELECTIONS_SUBMITTED",
            details: {
              role: party.role,
              dealMode: "SOLO",
            },
          },
        });

        return { success: true, bothSubmitted: false, soloCompleted: true };
      }

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

      return { success: true, bothSubmitted, soloCompleted: false };
    }),

  // Dismiss the lawyer warning modal for this party
  dismissLawyerWarning: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: {
          dealRoomId: input.dealRoomId,
          userId,
        },
      });

      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a party to this deal",
        });
      }

      if (party.lawyerWarningDismissedAt) {
        return { success: true };
      }

      await ctx.prisma.dealRoomParty.update({
        where: { id: party.id },
        data: { lawyerWarningDismissedAt: new Date() },
      });

      return { success: true };
    }),
});
