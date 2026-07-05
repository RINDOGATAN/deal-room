import { z } from "zod";
import { randomBytes } from "crypto";
import { createTRPCRouter, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { generateLicenseKey, sha256 } from "@/lib/crypto";
import {
  createEntitlement,
  suspendEntitlement,
  reactivateEntitlement,
  updateEntitlementJurisdictions,
} from "../services/licensing/entitlement";
import { features } from "@/config/features";
import { SPECIALIZATIONS, CERTIFICATIONS, EXPERT_TYPES } from "../services/experts/taxonomy";
import { GoverningLaw } from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/prisma";

// Helper to check 2FA and get admin record
const requireVerified2FA = async (
  email: string,
  getCookie: (name: string) => string | undefined,
  prisma: ExtendedPrismaClient
) => {
  const twoFactorVerified = getCookie("platform_admin_2fa_verified");
  if (twoFactorVerified !== "true") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "2FA verification required",
    });
  }

  const admin = await prisma.platformAdmin.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!admin || !admin.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Platform admin access required",
    });
  }

  return admin;
};

export const platformAdminRouter = createTRPCRouter({
  // Dashboard stats
  getDashboardStats: adminProcedure.query(async ({ ctx }) => {
    await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

    const [
      customerCount,
      dealCount,
      skillCount,
      supervisorCount,
      dealsByStatus,
      recentActivity,
    ] = await Promise.all([
      ctx.prisma.customer.count(),
      ctx.prisma.dealRoom.count(),
      ctx.prisma.skillPackage.count({ where: { isActive: true } }),
      ctx.prisma.supervisor.count({ where: { isActive: true } }),
      ctx.prisma.dealRoom.groupBy({
        by: ["status"],
        _count: true,
      }),
      ctx.prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          dealRoom: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

    return {
      customerCount,
      dealCount,
      skillCount,
      supervisorCount,
      dealsByStatus: dealsByStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count;
          return acc;
        },
        {} as Record<string, number>
      ),
      recentActivity,
    };
  }),

  // Supervisor management
  listSupervisors: adminProcedure.query(async ({ ctx }) => {
    await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

    return ctx.prisma.supervisor.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        barAdmissions: true,
        _count: {
          select: { assignments: true },
        },
      },
    });
  }),

  createSupervisor: adminProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      // Check if supervisor already exists
      const existing = await ctx.prisma.supervisor.findUnique({
        where: { email: input.email.toLowerCase() },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A supervisor with this email already exists",
        });
      }

      return ctx.prisma.supervisor.create({
        data: {
          email: input.email.toLowerCase(),
          name: input.name,
        },
      });
    }),

  toggleSupervisorActive: adminProcedure
    .input(z.object({
      supervisorId: z.string(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      return ctx.prisma.supervisor.update({
        where: { id: input.supervisorId },
        data: { isActive: input.isActive },
      });
    }),

  addBarAdmission: adminProcedure
    .input(z.object({
      supervisorId: z.string(),
      jurisdiction: z.enum(["CALIFORNIA", "ENGLAND_WALES", "SPAIN"]),
      barNumber: z.string().min(1, "Bar number is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      const existing = await ctx.prisma.supervisorBarAdmission.findUnique({
        where: {
          supervisorId_jurisdiction: {
            supervisorId: input.supervisorId,
            jurisdiction: input.jurisdiction,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Supervisor already has a bar admission for this jurisdiction",
        });
      }

      return ctx.prisma.supervisorBarAdmission.create({
        data: {
          supervisorId: input.supervisorId,
          jurisdiction: input.jurisdiction,
          barNumber: input.barNumber,
        },
      });
    }),

  removeBarAdmission: adminProcedure
    .input(z.object({ barAdmissionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      const admission = await ctx.prisma.supervisorBarAdmission.findUnique({
        where: { id: input.barAdmissionId },
      });

      if (!admission) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bar admission not found",
        });
      }

      await ctx.prisma.supervisorBarAdmission.delete({
        where: { id: input.barAdmissionId },
      });

      return { success: true };
    }),

  // Deal management (all deals)
  listAllDeals: adminProcedure.query(async ({ ctx }) => {
    await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

    return ctx.prisma.dealRoom.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        contractTemplate: true,
        parties: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        supervisorAssignments: {
          include: {
            supervisor: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });
  }),

  assignSupervisor: adminProcedure
    .input(z.object({
      supervisorId: z.string(),
      dealRoomId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const admin = await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      // Check if already assigned
      const existing = await ctx.prisma.supervisorAssignment.findUnique({
        where: {
          supervisorId_dealRoomId: {
            supervisorId: input.supervisorId,
            dealRoomId: input.dealRoomId,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Supervisor is already assigned to this deal",
        });
      }

      return ctx.prisma.supervisorAssignment.create({
        data: {
          supervisorId: input.supervisorId,
          dealRoomId: input.dealRoomId,
          assignedBy: admin.id,
        },
      });
    }),

  removeSupervisorAssignment: adminProcedure
    .input(z.object({ assignmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      return ctx.prisma.supervisorAssignment.delete({
        where: { id: input.assignmentId },
      });
    }),

  // Customer management
  listCustomers: adminProcedure
    .input(z.object({
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      const where = input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" as const } },
              { email: { contains: input.search, mode: "insensitive" as const } },
            ],
          }
        : {};

      return ctx.prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { entitlements: true },
          },
        },
      });
    }),

  // Create a new customer
  createCustomer: adminProcedure
    .input(z.object({
      name: z.string().min(1, "Name is required"),
      email: z.string().email("Valid email is required"),
      type: z.enum(["SAAS", "SELF_HOSTED"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      // Check if customer already exists
      const existing = await ctx.prisma.customer.findUnique({
        where: { email: input.email.toLowerCase() },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A customer with this email already exists",
        });
      }

      return ctx.prisma.customer.create({
        data: {
          name: input.name,
          email: input.email.toLowerCase(),
          type: input.type,
        },
      });
    }),

  // Get a single customer with all their entitlements
  getCustomer: adminProcedure
    .input(z.object({
      customerId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      const customer = await ctx.prisma.customer.findUnique({
        where: { id: input.customerId },
        include: {
          entitlements: {
            include: {
              skillPackage: true,
              _count: { select: { activations: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      return customer;
    }),

  // Create entitlement (assign skill to customer)
  createEntitlement: adminProcedure
    .input(z.object({
      customerId: z.string(),
      skillId: z.string(),
      licenseType: z.enum(["TRIAL", "SUBSCRIPTION", "PERPETUAL"]),
      jurisdictions: z.array(z.string()).min(1, "At least one jurisdiction is required"),
      maxActivations: z.number().int().positive().default(1),
      expiresAt: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      // Check customer exists
      const customer = await ctx.prisma.customer.findUnique({
        where: { id: input.customerId },
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      // Check for existing entitlement
      const skillPackage = await ctx.prisma.skillPackage.findUnique({
        where: { skillId: input.skillId },
      });

      if (!skillPackage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Skill package not found",
        });
      }

      const existingEntitlement = await ctx.prisma.skillEntitlement.findUnique({
        where: {
          customerId_skillPackageId: {
            customerId: input.customerId,
            skillPackageId: skillPackage.id,
          },
        },
      });

      if (existingEntitlement) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Customer already has an entitlement for this skill",
        });
      }

      try {
        return await createEntitlement({
          customerId: input.customerId,
          skillId: input.skillId,
          licenseKey: generateLicenseKey(),
          licenseType: input.licenseType,
          maxActivations: input.maxActivations,
          jurisdictions: input.jurisdictions,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        });
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to create entitlement",
        });
      }
    }),

  // Suspend an entitlement
  suspendEntitlement: adminProcedure
    .input(z.object({
      entitlementId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      const entitlement = await ctx.prisma.skillEntitlement.findUnique({
        where: { id: input.entitlementId },
      });

      if (!entitlement) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entitlement not found",
        });
      }

      await suspendEntitlement(input.entitlementId);
      return { success: true };
    }),

  // Reactivate a suspended entitlement
  reactivateEntitlement: adminProcedure
    .input(z.object({
      entitlementId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      try {
        await reactivateEntitlement(input.entitlementId);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to reactivate entitlement",
        });
      }
    }),

  // Update entitlement jurisdictions
  updateEntitlementJurisdictions: adminProcedure
    .input(z.object({
      entitlementId: z.string(),
      jurisdictions: z.array(z.string()).min(1, "At least one jurisdiction is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      try {
        await updateEntitlementJurisdictions(input.entitlementId, input.jurisdictions);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to update jurisdictions",
        });
      }
    }),

  // User management (read-only)
  listUsers: adminProcedure.query(async ({ ctx }) => {
    await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

    return ctx.prisma.user.findMany({
      orderBy: [
        { lastLoginAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      include: {
        accounts: true,
        _count: {
          select: { dealRoomParties: true },
        },
      },
    });
  }),

  // Skill management
  listSkillPackages: adminProcedure.query(async ({ ctx }) => {
    await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

    return ctx.prisma.skillPackage.findMany({
      orderBy: { installedAt: "desc" },
      include: {
        _count: {
          select: { entitlements: true },
        },
      },
    });
  }),

  // Analytics
  getAnalytics: adminProcedure.query(async ({ ctx }) => {
    await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

    const [
      totalDeals,
      completedDeals,
      avgRoundsResult,
      activeEntitlements,
      dealsByStatus,
      dealsBySkill,
      dealsByJurisdiction,
    ] = await Promise.all([
      ctx.prisma.dealRoom.count(),
      ctx.prisma.dealRoom.count({ where: { status: "COMPLETED" } }),
      ctx.prisma.dealRoom.aggregate({
        _avg: { currentRound: true },
      }),
      ctx.prisma.skillEntitlement.count({ where: { status: "ACTIVE" } }),
      ctx.prisma.dealRoom.groupBy({
        by: ["status"],
        _count: true,
      }),
      ctx.prisma.dealRoom.groupBy({
        by: ["contractTemplateId"],
        _count: true,
      }),
      ctx.prisma.dealRoom.groupBy({
        by: ["governingLaw"],
        _count: true,
      }),
    ]);

    // Get skill names for the grouped data
    const templateIds = dealsBySkill.map((d) => d.contractTemplateId);
    const templates = await ctx.prisma.contractTemplate.findMany({
      where: { id: { in: templateIds } },
      select: { id: true, displayName: true },
    });
    const templateMap = Object.fromEntries(templates.map((t) => [t.id, t.displayName]));

    return {
      totalDeals,
      completedDeals,
      avgRounds: avgRoundsResult._avg.currentRound || 0,
      activeEntitlements,
      dealsByStatus: dealsByStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count;
          return acc;
        },
        {} as Record<string, number>
      ),
      dealsBySkill: dealsBySkill.map((d) => ({
        skillName: templateMap[d.contractTemplateId] || "Unknown",
        count: d._count,
      })),
      dealsByJurisdiction: dealsByJurisdiction.map((d) => ({
        jurisdiction: d.governingLaw,
        count: d._count,
      })),
    };
  }),

  // ────────────────────────────────────────────────────────────
  // API Key Management (for Agent Negotiation API)
  // ────────────────────────────────────────────────────────────

  listApiKeys: adminProcedure
    .input(z.object({ customerId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      return ctx.prisma.apiKey.findMany({
        where: { customerId: input.customerId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          isActive: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      });
    }),

  createApiKey: adminProcedure
    .input(z.object({
      customerId: z.string(),
      name: z.string().min(1, "Name is required"),
      scopes: z.array(z.string()).min(1, "At least one scope is required"),
      expiresAt: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      const customer = await ctx.prisma.customer.findUnique({
        where: { id: input.customerId },
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      // Generate the raw API key
      const rawKey = `drk_${randomBytes(32).toString("hex")}`;
      const keyHash = sha256(rawKey);
      const keyPrefix = rawKey.slice(0, 12); // "drk_" + 8 hex chars

      const apiKey = await ctx.prisma.apiKey.create({
        data: {
          customerId: input.customerId,
          name: input.name,
          keyHash,
          keyPrefix,
          scopes: input.scopes,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        },
      });

      // Return the raw key ONLY on creation — it cannot be retrieved later
      return {
        id: apiKey.id,
        name: apiKey.name,
        key: rawKey,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      };
    }),

  revokeApiKey: adminProcedure
    .input(z.object({ apiKeyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      const apiKey = await ctx.prisma.apiKey.findUnique({
        where: { id: input.apiKeyId },
      });

      if (!apiKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      await ctx.prisma.apiKey.update({
        where: { id: input.apiKeyId },
        data: { isActive: false },
      });

      return { success: true };
    }),

  deleteApiKey: adminProcedure
    .input(z.object({ apiKeyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      const apiKey = await ctx.prisma.apiKey.findUnique({
        where: { id: input.apiKeyId },
      });

      if (!apiKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      await ctx.prisma.apiKey.delete({
        where: { id: input.apiKeyId },
      });

      return { success: true };
    }),

  // ────────────────────────────────────────────────────────────
  // Invite Code Management (northend.law auth)
  // ────────────────────────────────────────────────────────────

  listInviteCodes: adminProcedure
    .input(z.object({ customerId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      if (!features.inviteCodeAuth) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invite codes are not enabled for this brand",
        });
      }

      return ctx.prisma.inviteCode.findMany({
        where: { customerId: input.customerId },
        orderBy: { createdAt: "desc" },
        include: {
          usedBy: {
            select: { id: true, email: true, name: true },
          },
        },
      });
    }),

  createInviteCode: adminProcedure
    .input(z.object({
      customerId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      if (!features.inviteCodeAuth) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invite codes are not enabled for this brand",
        });
      }

      const customer = await ctx.prisma.customer.findUnique({
        where: { id: input.customerId },
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      // Generate a human-readable invite code: XXXX-XXXX
      const part1 = randomBytes(2).toString("hex").toUpperCase();
      const part2 = randomBytes(2).toString("hex").toUpperCase();
      const code = `${part1}-${part2}`;

      return ctx.prisma.inviteCode.create({
        data: {
          code,
          customerId: input.customerId,
        },
      });
    }),

  // ────────────────────────────────────────────────────────────
  // Expert Directory Management (cross-product lawyer onboarding)
  // ────────────────────────────────────────────────────────────

  listExpertProfiles: adminProcedure.query(async ({ ctx }) => {
    await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

    return ctx.prisma.lawyerProfile.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            image: true,
            isLawyer: true,
            role: true,
          },
        },
      },
    });
  }),

  getExpertProfile: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      const profile = await ctx.prisma.lawyerProfile.findUnique({
        where: { userId: input.userId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              company: true,
              image: true,
              isLawyer: true,
              role: true,
            },
          },
        },
      });

      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expert profile not found" });
      }

      return profile;
    }),

  /** Create or update a full expert profile — used for admin onboarding */
  upsertExpertProfile: adminProcedure
    .input(z.object({
      userId: z.string(),
      bio: z.string().max(2000).optional(),
      jurisdictions: z.array(z.enum(["CALIFORNIA", "ENGLAND_WALES", "SPAIN"])).default([]),
      languages: z.array(z.string()).min(1),
      isPublished: z.boolean().default(false),
      title: z.string().max(200).optional(),
      expertTypes: z.array(z.enum(EXPERT_TYPES)).default(["TECHNICAL"]),
      specializations: z.array(z.enum(SPECIALIZATIONS)).default([]),
      certifications: z.array(z.enum(CERTIFICATIONS)).default([]),
      countryCode: z.string().length(2).optional(),
      city: z.string().max(200).optional(),
      jurisdictionsCovered: z.array(z.string()).default([]),
      contactUrl: z.string().url().max(500).optional(),
      acceptingClients: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      // Ensure the user exists
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Mark user as lawyer if not already
      if (!user.isLawyer || user.role !== "LAWYER") {
        await ctx.prisma.user.update({
          where: { id: input.userId },
          data: { isLawyer: true, role: "LAWYER", onboardedAt: user.onboardedAt ?? new Date() },
        });
      }

      const data = {
        bio: input.bio ?? null,
        jurisdictions: input.jurisdictions as GoverningLaw[],
        languages: input.languages,
        isPublished: input.isPublished,
        title: input.title ?? null,
        expertTypes: input.expertTypes,
        specializations: input.specializations,
        certifications: input.certifications,
        countryCode: input.countryCode ?? null,
        city: input.city ?? null,
        jurisdictionsCovered: input.jurisdictionsCovered,
        contactUrl: input.contactUrl ?? null,
        acceptingClients: input.acceptingClients,
      };

      return ctx.prisma.lawyerProfile.upsert({
        where: { userId: input.userId },
        update: data,
        create: { userId: input.userId, ...data },
        include: {
          user: {
            select: { id: true, name: true, email: true, company: true },
          },
        },
      });
    }),

  /** Delete an expert profile (unpublishes from directory) */
  deleteExpertProfile: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      const profile = await ctx.prisma.lawyerProfile.findUnique({
        where: { userId: input.userId },
      });

      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expert profile not found" });
      }

      try {
        await ctx.prisma.$transaction([
          ctx.prisma.lawyerProfile.delete({
            where: { userId: input.userId },
          }),
          ctx.prisma.user.update({
            where: { id: input.userId },
            data: { isLawyer: false },
          }),
        ]);
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not delete expert profile. The user may have active deals or vettings that reference this account.",
        });
      }

      return { success: true };
    }),

  // ────────────────────────────────────────────────────────────
  // Negotiation Usage Reporting (Phase 1)
  // ────────────────────────────────────────────────────────────

  getCustomerUsage: adminProcedure
    .input(z.object({ customerId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

      const usages = await ctx.prisma.negotiationUsage.findMany({
        where: { customerId: input.customerId },
        orderBy: { createdAt: "desc" },
        include: {
          skillPackage: {
            select: { displayName: true, skillId: true },
          },
        },
      });

      // Aggregate by month and skill
      const byMonth: Record<string, Record<string, { agreed: number; failed: number }>> = {};
      for (const u of usages) {
        const month = u.createdAt.toISOString().slice(0, 7); // YYYY-MM
        const skill = u.skillPackage?.displayName || u.contractType;
        if (!byMonth[month]) byMonth[month] = {};
        if (!byMonth[month][skill]) byMonth[month][skill] = { agreed: 0, failed: 0 };
        if (u.outcome === "AGREED") byMonth[month][skill].agreed++;
        else byMonth[month][skill].failed++;
      }

      return {
        total: usages.length,
        byMonth,
        recent: usages.slice(0, 20),
      };
    }),

  // ────────────────────────────────────────────────────────────
  // Revenue Reporting (Phase 2)
  // ────────────────────────────────────────────────────────────

  getRevenueReport: adminProcedure.query(async ({ ctx }) => {
    await requireVerified2FA(ctx.adminSession.email, ctx.getCookie, ctx.prisma);

    const [events, totalByType, totalBySkill] = await Promise.all([
      ctx.prisma.revenueEvent.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          skillPackage: { select: { displayName: true, skillId: true } },
        },
      }),
      ctx.prisma.revenueEvent.groupBy({
        by: ["eventType"],
        _sum: { grossAmount: true, platformAmount: true, authorAmount: true },
        _count: true,
      }),
      ctx.prisma.revenueEvent.groupBy({
        by: ["skillPackageId"],
        _sum: { grossAmount: true, platformAmount: true, authorAmount: true },
        _count: true,
      }),
    ]);

    // Resolve skill names
    const skillIds = totalBySkill.map((s) => s.skillPackageId);
    const skills = await ctx.prisma.skillPackage.findMany({
      where: { id: { in: skillIds } },
      select: { id: true, displayName: true },
    });
    const skillMap = Object.fromEntries(skills.map((s) => [s.id, s.displayName]));

    return {
      recentEvents: events,
      totalByType: totalByType.map((t) => ({
        eventType: t.eventType,
        count: t._count,
        grossAmount: t._sum.grossAmount || 0,
        platformAmount: t._sum.platformAmount || 0,
        authorAmount: t._sum.authorAmount || 0,
      })),
      totalBySkill: totalBySkill.map((s) => ({
        skillName: skillMap[s.skillPackageId] || "Unknown",
        count: s._count,
        grossAmount: s._sum.grossAmount || 0,
        platformAmount: s._sum.platformAmount || 0,
        authorAmount: s._sum.authorAmount || 0,
      })),
    };
  }),

});
