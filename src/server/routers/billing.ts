// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { features } from "@/config/features";
import { cancelSubscription } from "@/lib/stripe";

export const billingRouter = createTRPCRouter({
  getConfig: protectedProcedure.query(() => {
    return {
      stripeEnabled: features.stripeEnabled,
      selfServiceUpgrade: features.selfServiceUpgrade,
    };
  }),

  getSubscriptionStatus: protectedProcedure.query(async ({ ctx }) => {
    const email = ctx.session.user.email;
    if (!email) return { entitlements: [], stripeCustomerId: null };

    const customer = await ctx.prisma.customer.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: {
        entitlements: {
          include: {
            skillPackage: {
              select: {
                skillId: true,
                displayName: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!customer) return { entitlements: [], stripeCustomerId: null };

    return {
      stripeCustomerId: customer.stripeCustomerId,
      entitlements: customer.entitlements.map((e) => ({
        id: e.id,
        skillId: e.skillPackage.skillId,
        name: e.skillPackage.displayName,
        status: e.status,
        licenseType: e.licenseType,
        expiresAt: e.expiresAt?.toISOString() ?? null,
        stripeSubscriptionId: e.stripeSubscriptionId,
      })),
    };
  }),

  getAvailablePlans: protectedProcedure.query(async ({ ctx }) => {
    const email = ctx.session.user.email;

    const packages = await ctx.prisma.skillPackage.findMany({
      where: { isPremium: true, isActive: true },
      orderBy: { displayName: "asc" },
    });

    // Check which ones the user already has entitlements for
    let entitledSkillPackageIds: Set<string> = new Set();
    if (email) {
      const customer = await ctx.prisma.customer.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        include: {
          entitlements: {
            where: { status: "ACTIVE" },
            select: { skillPackageId: true },
          },
        },
      });
      if (customer) {
        entitledSkillPackageIds = new Set(
          customer.entitlements.map((e) => e.skillPackageId)
        );
      }
    }

    return packages.map((pkg) => ({
      id: pkg.id,
      skillId: pkg.skillId,
      name: pkg.displayName,
      description: pkg.description,
      priceAmount: pkg.priceAmount,
      priceCurrency: pkg.priceCurrency,
      isEntitled: entitledSkillPackageIds.has(pkg.id),
    }));
  }),

  cancelSubscription: protectedProcedure
    .input(z.object({ entitlementId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const email = ctx.session.user.email;
      if (!email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No email on session" });
      }

      const entitlement = await ctx.prisma.skillEntitlement.findUnique({
        where: { id: input.entitlementId },
        include: { customer: { select: { email: true } } },
      });

      if (!entitlement || entitlement.customer.email?.toLowerCase() !== email.toLowerCase()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entitlement not found" });
      }

      if (entitlement.status !== "ACTIVE" || !entitlement.stripeSubscriptionId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Subscription is not active" });
      }

      await cancelSubscription(entitlement.stripeSubscriptionId);

      await ctx.prisma.skillEntitlement.update({
        where: { id: input.entitlementId },
        data: { status: "EXPIRED" },
      });

      return { success: true };
    }),
});
