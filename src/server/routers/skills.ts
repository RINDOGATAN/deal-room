import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const skillsRouter = createTRPCRouter({
  // List all available contract templates
  listTemplates: publicProcedure.query(async ({ ctx }) => {
    const templates = await ctx.prisma.contractTemplate.findMany({
      where: { isActive: true },
      select: {
        id: true,
        contractType: true,
        displayName: true,
        description: true,
        version: true,
        _count: {
          select: {
            clauses: true,
          },
        },
      },
      orderBy: { displayName: "asc" },
    });

    return templates.map((t) => ({
      ...t,
      clauseCount: t._count.clauses,
    }));
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
