import { z } from "zod";
import { createTRPCRouter, protectedProcedure, lawyerProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { GoverningLaw } from "@prisma/client";
import { sendClientInvitationEmail, sendRecommendationRequestEmail } from "@/lib/email";
import { checkDealCreationEntitlement } from "../services/licensing/entitlement";
import { SPECIALIZATIONS, CERTIFICATIONS, EXPERT_TYPES } from "../services/experts/taxonomy";
import { features } from "@/config/features";

const GOVERNING_LAW_TO_JURISDICTION: Record<string, string> = {
  CALIFORNIA: "CALIFORNIA",
  ENGLAND_WALES: "ENGLAND_WALES",
  SPAIN: "SPAIN",
};

export const lawyerRouter = createTRPCRouter({
  /** Set current user as a lawyer */
  register: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.user.update({
      where: { id: ctx.session.user.id },
      data: { isLawyer: true },
    });
    return { success: true };
  }),

  /** Set user role (onboarding) */
  setRole: protectedProcedure
    .input(z.object({ role: z.enum(["BUSINESS_OWNER", "LAWYER"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          role: input.role,
          isLawyer: input.role === "LAWYER",
          onboardedAt: new Date(),
        },
      });
      return { success: true };
    }),

  /** Get lawyer profile status */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { isLawyer: true, role: true },
    });
    return { isLawyer: user?.isLawyer ?? false, role: user?.role ?? null };
  }),

  /** Create a new vetting for a template + jurisdiction + language */
  createVetting: lawyerProcedure
    .input(
      z.object({
        contractTemplateId: z.string(),
        governingLaw: z.enum(["CALIFORNIA", "ENGLAND_WALES", "SPAIN"]),
        contractLanguage: z.enum(["en", "es"]).default("en"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.prisma.contractTemplate.findUnique({
        where: { id: input.contractTemplateId },
        include: { skillPackage: true },
      });
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      // Check entitlement for licensed skills (skipped during the promo —
      // `features.allSkillsFree` unlocks every skill for everyone).
      if (template.skillPackageId && !features.allSkillsFree) {
        const userEmail = ctx.session.user.email!;
        const customer = await ctx.prisma.customer.findFirst({
          where: { email: { equals: userEmail, mode: "insensitive" } },
        });

        if (!customer) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This contract skill has not been enabled on your account. Please contact us to get access.",
          });
        }

        const jurisdiction = GOVERNING_LAW_TO_JURISDICTION[input.governingLaw];
        const entitlement = await checkDealCreationEntitlement(
          customer.id,
          template.contractType,
          jurisdiction
        );

        if (!entitlement.entitled) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This contract skill has not been enabled on your account. Please contact us to get access.",
          });
        }
      }

      const vetting = await ctx.prisma.lawyerVetting.create({
        data: {
          lawyerId: ctx.session.user.id,
          contractTemplateId: input.contractTemplateId,
          governingLaw: input.governingLaw as GoverningLaw,
          contractLanguage: input.contractLanguage,
        },
      });
      return vetting;
    }),

  /** List lawyer's vettings */
  listVettings: lawyerProcedure.query(async ({ ctx }) => {
    const vettings = await ctx.prisma.lawyerVetting.findMany({
      where: { lawyerId: ctx.session.user.id },
      include: {
        contractTemplate: {
          select: { displayName: true, contractType: true, displayNameLocalized: true },
        },
        _count: {
          select: {
            recommendations: true,
            clientInvitations: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return vettings;
  }),

  /** Get full vetting detail with recommendations */
  getVetting: lawyerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const vetting = await ctx.prisma.lawyerVetting.findFirst({
        where: { id: input.id, lawyerId: ctx.session.user.id },
        include: {
          contractTemplate: {
            include: {
              clauses: {
                orderBy: { order: "asc" },
                include: {
                  options: { orderBy: { order: "asc" } },
                },
              },
            },
          },
          recommendations: true,
          clientInvitations: {
            orderBy: { sentAt: "desc" },
          },
        },
      });
      if (!vetting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vetting not found" });
      }
      return vetting;
    }),

  /** Save/update a recommendation for a clause */
  saveRecommendation: lawyerProcedure
    .input(
      z.object({
        vettingId: z.string(),
        clauseTemplateId: z.string(),
        clauseOptionId: z.string(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const vetting = await ctx.prisma.lawyerVetting.findFirst({
        where: { id: input.vettingId, lawyerId: ctx.session.user.id },
      });
      if (!vetting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vetting not found" });
      }
      if (vetting.status === "APPROVED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot modify approved vetting" });
      }

      const recommendation = await ctx.prisma.lawyerRecommendation.upsert({
        where: {
          vettingId_clauseTemplateId: {
            vettingId: input.vettingId,
            clauseTemplateId: input.clauseTemplateId,
          },
        },
        update: {
          clauseOptionId: input.clauseOptionId,
          note: input.note ?? null,
        },
        create: {
          vettingId: input.vettingId,
          clauseTemplateId: input.clauseTemplateId,
          clauseOptionId: input.clauseOptionId,
          note: input.note ?? null,
        },
      });
      return recommendation;
    }),

  /** Approve vetting — requires all clauses to have recommendations */
  approveVetting: lawyerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const vetting = await ctx.prisma.lawyerVetting.findFirst({
        where: { id: input.id, lawyerId: ctx.session.user.id },
        include: {
          contractTemplate: {
            include: { clauses: true },
          },
          recommendations: true,
        },
      });
      if (!vetting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vetting not found" });
      }
      if (vetting.status === "APPROVED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Already approved" });
      }

      const clauseIds = vetting.contractTemplate.clauses.map((c) => c.id);
      const recommendedClauseIds = new Set(vetting.recommendations.map((r) => r.clauseTemplateId));
      const missing = clauseIds.filter((id) => !recommendedClauseIds.has(id));
      if (missing.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Missing recommendations for ${missing.length} clause(s)`,
        });
      }

      await ctx.prisma.lawyerVetting.update({
        where: { id: input.id },
        data: { status: "APPROVED", approvedAt: new Date() },
      });
      return { success: true };
    }),

  /** Send client invitation from approved vetting */
  sendClientInvitation: lawyerProcedure
    .input(
      z.object({
        vettingId: z.string(),
        email: z.string().email(),
        contactName: z.string().optional(),
        company: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const vetting = await ctx.prisma.lawyerVetting.findFirst({
        where: { id: input.vettingId, lawyerId: ctx.session.user.id },
        include: {
          contractTemplate: {
            select: { displayName: true, skillPackageId: true },
          },
        },
      });
      if (!vetting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vetting not found" });
      }
      if (vetting.status !== "APPROVED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Vetting must be approved before sending invitations" });
      }

      // Check "Vetted Contracts" entitlement — skipped during the promo.
      const lawyerEmail = ctx.session.user.email;
      if (lawyerEmail && !features.allSkillsFree) {
        const customer = await ctx.prisma.customer.findFirst({
          where: { email: { equals: lawyerEmail, mode: "insensitive" } },
        });
        const vettedPkg = await ctx.prisma.skillPackage.findUnique({
          where: { skillId: "com.nel.features.vetted-contracts" },
        });
        if (vettedPkg?.isPremium) {
          const vettedEntitlement = customer
            ? await ctx.prisma.skillEntitlement.findUnique({
                where: {
                  customerId_skillPackageId: {
                    customerId: customer.id,
                    skillPackageId: vettedPkg.id,
                  },
                },
              })
            : null;
          if (!vettedEntitlement || vettedEntitlement.status !== "ACTIVE") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "A Vetted Contracts subscription is required to send client invitations. Visit the Billing page to subscribe.",
            });
          }
        }

        // Check premium skill entitlement if template is premium
        if (vetting.contractTemplate.skillPackageId) {
          const skillEntitlement = customer
            ? await ctx.prisma.skillEntitlement.findUnique({
                where: {
                  customerId_skillPackageId: {
                    customerId: customer.id,
                    skillPackageId: vetting.contractTemplate.skillPackageId,
                  },
                },
              })
            : null;
          if (!skillEntitlement || skillEntitlement.status !== "ACTIVE") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "An active subscription for this contract skill is required. Visit the Billing page to subscribe.",
            });
          }
        }
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const invitation = await ctx.prisma.clientInvitation.create({
        data: {
          vettingId: input.vettingId,
          lawyerId: ctx.session.user.id,
          email: input.email,
          contactName: input.contactName,
          company: input.company,
          expiresAt,
        },
      });

      // Send email
      const lawyerName = ctx.session.user.name || ctx.session.user.email || "Your lawyer";
      await sendClientInvitationEmail({
        to: input.email,
        token: invitation.token,
        templateName: vetting.contractTemplate.displayName,
        lawyerName,
      });

      return invitation;
    }),

  /** List invitations for a vetting */
  listClientInvitations: lawyerProcedure
    .input(z.object({ vettingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const vetting = await ctx.prisma.lawyerVetting.findFirst({
        where: { id: input.vettingId, lawyerId: ctx.session.user.id },
      });
      if (!vetting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vetting not found" });
      }
      return ctx.prisma.clientInvitation.findMany({
        where: { vettingId: input.vettingId },
        orderBy: { sentAt: "desc" },
      });
    }),

  /** Accept a client invitation (public — any authenticated user) */
  acceptClientInvitation: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.prisma.clientInvitation.findUnique({
        where: { token: input.token },
        include: {
          vetting: {
            include: {
              contractTemplate: { select: { displayName: true } },
              lawyer: { select: { name: true, email: true } },
            },
          },
        },
      });
      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      }
      if (invitation.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation is no longer valid" });
      }
      if (invitation.expiresAt < new Date()) {
        await ctx.prisma.clientInvitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation has expired" });
      }

      await ctx.prisma.clientInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });

      return {
        vettingId: invitation.vettingId,
        templateName: invitation.vetting.contractTemplate.displayName,
        lawyerName: invitation.vetting.lawyer.name || invitation.vetting.lawyer.email,
        governingLaw: invitation.vetting.governingLaw,
        contractLanguage: invitation.vetting.contractLanguage,
      };
    }),

  /** Get client invitation by token (public — for landing page) */
  getClientInvitation: protectedProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const invitation = await ctx.prisma.clientInvitation.findUnique({
        where: { token: input.token },
        include: {
          vetting: {
            include: {
              contractTemplate: {
                select: { displayName: true, contractType: true, displayNameLocalized: true },
              },
              lawyer: { select: { name: true, email: true } },
            },
          },
        },
      });
      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      }
      return invitation;
    }),

  /** Get vetting summary for deal creation (any authenticated user with valid invitation) */
  getVettingSummary: protectedProcedure
    .input(z.object({ vettingId: z.string(), token: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify the user has an accepted invitation for this vetting
      const invitation = await ctx.prisma.clientInvitation.findFirst({
        where: {
          token: input.token,
          vettingId: input.vettingId,
          status: "ACCEPTED",
        },
      });
      if (!invitation) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Valid invitation required" });
      }

      const vetting = await ctx.prisma.lawyerVetting.findUnique({
        where: { id: input.vettingId },
        include: {
          contractTemplate: {
            select: { displayName: true, contractType: true, displayNameLocalized: true },
          },
          lawyer: { select: { name: true, email: true } },
        },
      });
      if (!vetting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vetting not found" });
      }
      return vetting;
    }),

  // ================================================================
  // LAWYER DIRECTORY
  // ================================================================

  /** Lawyer fetches own directory profile for editing */
  getMyDirectoryProfile: lawyerProcedure.query(async ({ ctx }) => {
    const profile = await ctx.prisma.lawyerProfile.findUnique({
      where: { userId: ctx.session.user.id },
    });
    return profile;
  }),

  /** Upsert lawyer directory profile */
  updateDirectoryProfile: lawyerProcedure
    .input(
      z.object({
        bio: z.string().max(2000).optional(),
        jurisdictions: z.array(z.enum(["CALIFORNIA", "ENGLAND_WALES", "SPAIN"])),
        languages: z.array(z.string()).min(1),
        isPublished: z.boolean(),
        // Cross-product directory fields
        title: z.string().max(200).optional(),
        expertTypes: z.array(z.enum(EXPERT_TYPES)).optional(),
        specializations: z.array(z.enum(SPECIALIZATIONS)).optional(),
        certifications: z.array(z.enum(CERTIFICATIONS)).optional(),
        countryCode: z.string().length(2).optional(),
        city: z.string().max(200).optional(),
        jurisdictionsCovered: z.array(z.string()).optional(),
        contactUrl: z.string().url().max(500).optional(),
        acceptingClients: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Cannot publish without bio + jurisdictions + languages
      if (input.isPublished) {
        if (!input.bio || input.bio.trim().length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Bio is required to publish" });
        }
        if (input.jurisdictions.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "At least one jurisdiction is required to publish" });
        }
      }

      const crossProductFields = {
        title: input.title ?? null,
        expertTypes: input.expertTypes ?? ["LEGAL"],
        specializations: input.specializations ?? [],
        certifications: input.certifications ?? [],
        countryCode: input.countryCode ?? null,
        city: input.city ?? null,
        jurisdictionsCovered: input.jurisdictionsCovered ?? [],
        contactUrl: input.contactUrl ?? null,
        acceptingClients: input.acceptingClients ?? true,
      };

      const profile = await ctx.prisma.lawyerProfile.upsert({
        where: { userId: ctx.session.user.id },
        update: {
          bio: input.bio ?? null,
          jurisdictions: input.jurisdictions as GoverningLaw[],
          languages: input.languages,
          isPublished: input.isPublished,
          ...crossProductFields,
        },
        create: {
          userId: ctx.session.user.id,
          bio: input.bio ?? null,
          jurisdictions: input.jurisdictions as GoverningLaw[],
          languages: input.languages,
          isPublished: input.isPublished,
          ...crossProductFields,
        },
      });
      return profile;
    }),

  /** Browse published lawyer directory */
  directory: protectedProcedure
    .input(
      z.object({
        jurisdiction: z.enum(["CALIFORNIA", "ENGLAND_WALES", "SPAIN"]).optional(),
        language: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        isPublished: true,
        expertTypes: { has: "LEGAL" },
      };
      if (input?.jurisdiction) {
        where.jurisdictions = { has: input.jurisdiction };
      }
      if (input?.language) {
        where.languages = { has: input.language };
      }

      const profiles = await ctx.prisma.lawyerProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              company: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      // Get approved vetting count per lawyer
      const lawyerIds = profiles.map((p) => p.userId);
      const vettingCounts = await ctx.prisma.lawyerVetting.groupBy({
        by: ["lawyerId"],
        where: { lawyerId: { in: lawyerIds }, status: "APPROVED" },
        _count: true,
      });
      const countMap = new Map(vettingCounts.map((v) => [v.lawyerId, v._count]));

      return profiles.map((p) => {
        const { notifyEmails: _omit, ...rest } = p;
        void _omit;
        return {
          ...rest,
          approvedVettingCount: countMap.get(p.userId) ?? 0,
        };
      });
    }),

  /** Business owner sends recommendation request to a published lawyer */
  requestRecommendation: protectedProcedure
    .input(
      z.object({
        lawyerId: z.string(),
        contractType: z.string(),
        governingLaw: z.enum(["CALIFORNIA", "ENGLAND_WALES", "SPAIN"]),
        message: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Cannot request from yourself
      if (input.lawyerId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot request recommendation from yourself" });
      }

      // Verify lawyer has published profile
      const lawyerProfile = await ctx.prisma.lawyerProfile.findUnique({
        where: { userId: input.lawyerId },
        include: { user: { select: { name: true, email: true } } },
      });
      if (!lawyerProfile || !lawyerProfile.isPublished) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lawyer not found in directory" });
      }

      // Check no duplicate PENDING request
      const existing = await ctx.prisma.recommendationRequest.findFirst({
        where: {
          requesterId: ctx.session.user.id,
          lawyerId: input.lawyerId,
          contractType: input.contractType,
          governingLaw: input.governingLaw as GoverningLaw,
          status: "PENDING",
        },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "You already have a pending request for this contract type and jurisdiction" });
      }

      const request = await ctx.prisma.recommendationRequest.create({
        data: {
          requesterId: ctx.session.user.id,
          lawyerId: input.lawyerId,
          contractType: input.contractType,
          governingLaw: input.governingLaw as GoverningLaw,
          message: input.message ?? null,
          // 30-day expiry. Without this, accepted-but-abandoned
          // requests sat in ACCEPTED state forever; PENDING ones
          // also lingered if the lawyer never responded.
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Send email notification to the lawyer
      const requester = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { name: true, email: true, company: true },
      });
      const requesterEmail = requester?.email || ctx.session.user.email || "";
      const requesterName = requester?.name || requesterEmail || "A business owner";
      const requesterCompany = requester?.company || undefined;
      try {
        await sendRecommendationRequestEmail({
          to: lawyerProfile.user.email!,
          bcc: lawyerProfile.notifyEmails,
          requesterName,
          requesterEmail,
          requesterCompany,
          contractType: input.contractType,
          governingLaw: input.governingLaw,
          message: input.message,
        });
      } catch {
        // Email failure should not block the request
        console.error("Failed to send recommendation request email");
      }

      return request;
    }),

  /** Lawyer views incoming recommendation requests */
  listIncomingRequests: lawyerProcedure.query(async ({ ctx }) => {
    return ctx.prisma.recommendationRequest.findMany({
      where: { lawyerId: ctx.session.user.id },
      include: {
        requester: {
          select: { id: true, name: true, email: true, company: true },
        },
        vetting: {
          select: { id: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  /** Business owner views sent recommendation requests */
  listSentRequests: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.recommendationRequest.findMany({
      where: { requesterId: ctx.session.user.id },
      include: {
        lawyer: {
          select: { id: true, name: true, email: true, company: true },
        },
        vetting: {
          select: { id: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  /** Lawyer accepts or declines a pending request */
  respondToRequest: lawyerProcedure
    .input(
      z.object({
        requestId: z.string(),
        action: z.enum(["ACCEPTED", "DECLINED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.recommendationRequest.findFirst({
        where: { id: input.requestId, lawyerId: ctx.session.user.id, status: "PENDING" },
      });
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pending request not found" });
      }
      if (request.expiresAt < new Date()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This request has expired and can no longer be accepted or declined.",
        });
      }

      return ctx.prisma.recommendationRequest.update({
        where: { id: input.requestId },
        data: {
          status: input.action,
          respondedAt: new Date(),
        },
      });
    }),

  /** Requester cancels their own pending or accepted request */
  cancelRequest: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.recommendationRequest.findFirst({
        where: {
          id: input.requestId,
          requesterId: ctx.session.user.id,
          status: { in: ["PENDING", "ACCEPTED"] },
        },
      });
      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cancellable request not found",
        });
      }
      return ctx.prisma.recommendationRequest.update({
        where: { id: input.requestId },
        data: { status: "CANCELLED" },
      });
    }),

  /** Lawyer links an accepted request to a completed vetting */
  completeRequest: lawyerProcedure
    .input(
      z.object({
        requestId: z.string(),
        vettingId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.recommendationRequest.findFirst({
        where: { id: input.requestId, lawyerId: ctx.session.user.id, status: "ACCEPTED" },
      });
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Accepted request not found" });
      }
      if (request.expiresAt < new Date()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This request has expired. Ask the requester to start a new one.",
        });
      }

      // Verify the vetting exists and belongs to this lawyer
      const vetting = await ctx.prisma.lawyerVetting.findFirst({
        where: { id: input.vettingId, lawyerId: ctx.session.user.id },
      });
      if (!vetting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vetting not found" });
      }

      return ctx.prisma.recommendationRequest.update({
        where: { id: input.requestId },
        data: {
          status: "COMPLETED",
          vettingId: input.vettingId,
        },
      });
    }),

  /** Get recommendations for a deal's vetting (used by negotiate page) */
  getRecommendations: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify user is party to the deal
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: { dealRoomId: input.dealRoomId, userId: ctx.session.user.id },
      });
      if (!party) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a party to this deal" });
      }

      const dealRoom = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealRoomId },
        select: {
          lawyerVettingId: true,
          lawyerVetting: {
            include: {
              recommendations: true,
              lawyer: { select: { name: true, email: true } },
            },
          },
        },
      });

      if (!dealRoom?.lawyerVettingId || !dealRoom.lawyerVetting) {
        return null;
      }

      return {
        lawyerName: dealRoom.lawyerVetting.lawyer.name || dealRoom.lawyerVetting.lawyer.email,
        recommendations: dealRoom.lawyerVetting.recommendations,
      };
    }),
});
