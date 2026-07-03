import { z } from "zod";
import { createTRPCRouter, protectedProcedure, lawyerProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { GoverningLaw } from "@prisma/client";
import { SPECIALIZATIONS, CERTIFICATIONS, EXPERT_TYPES } from "../services/experts/taxonomy";

// NOTE (2026-07): the contract-vetting flow (LawyerVetting / LawyerRecommendation /
// ClientInvitation procedures) and the in-app lawyer directory browse were removed
// together with the lawyer-expert directory. The RecommendationRequest inbox below
// survives — the cross-app experts contact API writes to it for technical and
// deployment experts.

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

  // ================================================================
  // EXPERT DIRECTORY PROFILE (shared by technical/deployment experts)
  // ================================================================

  /** Expert fetches own directory profile for editing */
  getMyDirectoryProfile: lawyerProcedure.query(async ({ ctx }) => {
    const profile = await ctx.prisma.lawyerProfile.findUnique({
      where: { userId: ctx.session.user.id },
    });
    return profile;
  }),

  /** Upsert expert directory profile */
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
        expertTypes: input.expertTypes ?? ["TECHNICAL"],
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

  // ================================================================
  // ASSISTANCE REQUESTS (RecommendationRequest — fed by the cross-app
  // experts contact API; the expert inbox lives at /lawyers/requests)
  // ================================================================

  /** Expert views incoming assistance requests */
  listIncomingRequests: lawyerProcedure.query(async ({ ctx }) => {
    return ctx.prisma.recommendationRequest.findMany({
      where: { lawyerId: ctx.session.user.id },
      include: {
        requester: {
          select: { id: true, name: true, email: true, company: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  /** Requester views sent assistance requests */
  listSentRequests: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.recommendationRequest.findMany({
      where: { requesterId: ctx.session.user.id },
      include: {
        lawyer: {
          select: { id: true, name: true, email: true, company: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  /** Expert accepts or declines a pending request */
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
});
