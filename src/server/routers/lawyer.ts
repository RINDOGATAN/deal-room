import { z } from "zod";
import { createTRPCRouter, protectedProcedure, lawyerProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { GoverningLaw } from "@prisma/client";
import { sendClientInvitationEmail } from "@/lib/email";
import { checkDealCreationEntitlement } from "../services/licensing/entitlement";

const GOVERNING_LAW_TO_JURISDICTION: Record<string, string> = {
  CALIFORNIA: "US-CA",
  ENGLAND_WALES: "GB",
  SPAIN: "ES",
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

  /** Get lawyer profile status */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { isLawyer: true },
    });
    return { isLawyer: user?.isLawyer ?? false };
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

      // Check entitlement for licensed skills
      if (template.skillPackageId) {
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

      // Check "Vetted Contracts" entitlement
      const lawyerEmail = ctx.session.user.email;
      if (lawyerEmail) {
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
