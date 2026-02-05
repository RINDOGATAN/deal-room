import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const skillsRouter = createTRPCRouter({
  // List all available contract templates with licensing info
  listTemplates: publicProcedure.query(async ({ ctx }) => {
    const templates = await ctx.prisma.contractTemplate.findMany({
      where: {
        isActive: true,
        // Exclude internal template(s) not meant for users
        NOT: {
          contractType: "TEMPLATE",
        },
      },
      select: {
        id: true,
        contractType: true,
        displayName: true,
        description: true,
        version: true,
        skillPackageId: true, // Include to check if licensed
        _count: {
          select: {
            clauses: true,
          },
        },
      },
      orderBy: { displayName: "asc" },
    });

    return templates.map((t) => ({
      id: t.id,
      contractType: t.contractType,
      displayName: t.displayName,
      description: t.description,
      version: t.version,
      clauseCount: t._count.clauses,
      requiresLicense: !!t.skillPackageId, // true = paid skill, false = free
    }));
  }),

  // List templates with user's entitlement status (for authenticated users)
  listTemplatesWithAccess: protectedProcedure.query(async ({ ctx }) => {
    const userEmail = ctx.session.user.email;

    // Get all active templates
    const templates = await ctx.prisma.contractTemplate.findMany({
      where: {
        isActive: true,
        NOT: { contractType: "TEMPLATE" },
      },
      select: {
        id: true,
        contractType: true,
        displayName: true,
        description: true,
        version: true,
        skillPackageId: true,
        skillPackage: {
          select: {
            id: true,
            skillId: true,
          },
        },
        _count: {
          select: { clauses: true },
        },
      },
      orderBy: { displayName: "asc" },
    });

    // Find customer by email to check entitlements
    const customer = userEmail
      ? await ctx.prisma.customer.findFirst({
          where: { email: userEmail },
          include: {
            entitlements: {
              where: { status: "ACTIVE" },
              select: {
                skillPackageId: true,
                jurisdictions: true,
                expiresAt: true,
              },
            },
          },
        })
      : null;

    // Map entitlements by skillPackageId for quick lookup
    const entitlementMap = new Map(
      customer?.entitlements.map((e) => [e.skillPackageId, e]) || []
    );

    return templates.map((t) => {
      const requiresLicense = !!t.skillPackageId;
      const entitlement = t.skillPackageId
        ? entitlementMap.get(t.skillPackageId)
        : null;

      return {
        id: t.id,
        contractType: t.contractType,
        displayName: t.displayName,
        description: t.description,
        version: t.version,
        clauseCount: t._count.clauses,
        requiresLicense,
        // Access info for licensed skills
        hasAccess: !requiresLicense || !!entitlement,
        entitledJurisdictions: entitlement?.jurisdictions || [],
        expiresAt: entitlement?.expiresAt || null,
      };
    });
  }),

  // Get a specific template with all clauses and options
  getTemplate: publicProcedure
    .input(z.object({ contractType: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.prisma.contractTemplate.findUnique({
        where: { contractType: input.contractType },
        include: {
          clauses: {
            orderBy: { order: "asc" },
            include: {
              options: {
                orderBy: { order: "asc" },
              },
            },
          },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contract template not found",
        });
      }

      return template;
    }),

  // Get categories for a template (for grouping clauses in UI)
  getCategories: publicProcedure
    .input(z.object({ contractType: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.prisma.contractTemplate.findUnique({
        where: { contractType: input.contractType },
        include: {
          clauses: {
            select: {
              category: true,
            },
            distinct: ["category"],
            orderBy: { order: "asc" },
          },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contract template not found",
        });
      }

      return template.clauses.map((c) => c.category);
    }),

  // Sync skills from filesystem (admin only - for development)
  sync: protectedProcedure.mutation(async ({ ctx }) => {
    // In production, this would be an admin-only operation
    // For now, we'll call the skill loader
    const { syncSkillsToDatabase } = await import(
      "@/server/services/skills/loader"
    );

    const result = await syncSkillsToDatabase(ctx.prisma);

    return result;
  }),
});
