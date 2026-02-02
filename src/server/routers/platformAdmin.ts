import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

// Helper to check 2FA and get admin record
const requireVerified2FA = async (
  email: string,
  getCookie: (name: string) => string | undefined,
  prisma: any
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
});
