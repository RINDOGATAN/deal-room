// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import type { GoverningLaw } from "@prisma/client";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { features } from "@/config/features";

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
        templateFamily: true,
        nativeJurisdiction: true,
        jurisdictions: true,
        languages: true,
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
      templateFamily: t.templateFamily,
      nativeJurisdiction: t.nativeJurisdiction,
      jurisdictions: t.jurisdictions,
      languages: t.languages,
      // During the promo, treat every template as free. Stripe + the
      // SkillPackage records stay in place — only the UI flag flips.
      requiresLicense: features.allSkillsFree ? false : !!t.skillPackageId,
    }));
  }),

  // List templates with user's entitlement status (for authenticated users)
  listTemplatesWithAccess: protectedProcedure
    .input(z.object({
      language: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
    const userEmail = ctx.session.user.email;
    const language = input?.language;

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
        templateFamily: true,
        nativeJurisdiction: true,
        jurisdictions: true,
        languages: true,
        displayNameLocalized: true,
        descriptionLocalized: true,
        category: true,
        categoryLocalized: true,
        soloModeSupported: true,
        soloModeDefault: true,
        soloModeOnly: true,
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

    // Find customer by email to check entitlements (case-insensitive)
    const customer = userEmail
      ? await ctx.prisma.customer.findFirst({
          where: { email: { equals: userEmail, mode: "insensitive" } },
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
      // Promo mode flips the lock off but keeps the rest of the row
      // intact, so the UI's "free during launch" banner shows up but
      // category / family / soloMode flags still drive the wizard.
      const requiresLicense = features.allSkillsFree ? false : !!t.skillPackageId;
      const entitlement = t.skillPackageId
        ? entitlementMap.get(t.skillPackageId)
        : null;

      // Resolve localized displayName/description/category if language specified
      let displayName = t.displayName;
      let description = t.description;
      let category = t.category;
      if (language && language !== "en") {
        const dnLocalized = t.displayNameLocalized as Record<string, string> | null;
        const descLocalized = t.descriptionLocalized as Record<string, string> | null;
        const catLocalized = t.categoryLocalized as Record<string, string> | null;
        if (dnLocalized?.[language]) displayName = dnLocalized[language];
        if (descLocalized?.[language]) description = descLocalized[language];
        if (catLocalized?.[language]) category = catLocalized[language];
      }

      return {
        id: t.id,
        contractType: t.contractType,
        displayName,
        description,
        category,
        version: t.version,
        clauseCount: t._count.clauses,
        templateFamily: t.templateFamily,
        nativeJurisdiction: t.nativeJurisdiction,
        jurisdictions: t.jurisdictions,
        languages: t.languages,
        requiresLicense,
        skillPackageId: t.skillPackageId,
        soloModeSupported: t.soloModeSupported,
        soloModeDefault: t.soloModeDefault,
        soloModeOnly: t.soloModeOnly,
        // Access info for licensed skills
        hasAccess: features.allSkillsFree ? true : !requiresLicense || !!entitlement,
        entitledJurisdictions: entitlement?.jurisdictions || [],
        expiresAt: entitlement?.expiresAt || null,
      };
    });
  }),

  // Resolve which template to use for a family + jurisdiction combination
  getTemplateForFamily: publicProcedure
    .input(z.object({
      templateFamily: z.string(),
      jurisdiction: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Try to find a native template for this jurisdiction
      const nativeTemplate = await ctx.prisma.contractTemplate.findFirst({
        where: {
          templateFamily: input.templateFamily,
          nativeJurisdiction: input.jurisdiction as GoverningLaw,
          isActive: true,
        },
        select: {
          id: true,
          contractType: true,
          displayName: true,
          nativeJurisdiction: true,
        },
      });

      if (nativeTemplate) {
        return { ...nativeTemplate, isNative: true };
      }

      // Fall back to the first template in the family (usually the default/California one)
      const defaultTemplate = await ctx.prisma.contractTemplate.findFirst({
        where: {
          templateFamily: input.templateFamily,
          isActive: true,
        },
        select: {
          id: true,
          contractType: true,
          displayName: true,
          nativeJurisdiction: true,
        },
        orderBy: { createdAt: "asc" },
      });

      if (!defaultTemplate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No template found for family ${input.templateFamily}`,
        });
      }

      return { ...defaultTemplate, isNative: false };
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
