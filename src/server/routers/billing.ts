// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { headers } from "next/headers";
import { features } from "@/config/features";
import { cancelSubscription } from "@/lib/stripe";
import { displayPrice, preferredCurrency, type BillingCurrency } from "@/lib/contract-billing";
import { resolveVisitorCurrencyFromHeaders, toBillingCurrency } from "@/lib/currency";
import { getPriceTable } from "../services/billing/pricing";
import { isDealPaid } from "../services/billing/deal-entitlement";
import { localeFromRequest } from "../services/billing/checkout";

export const billingRouter = createTRPCRouter({
  getConfig: protectedProcedure.query(() => {
    return {
      stripeEnabled: features.stripeEnabled,
      selfServiceUpgrade: features.selfServiceUpgrade,
    };
  }),

  /**
   * Pay per contract: the price to show per currency (from
   * `PRICE_DISPLAY_CONTRACT` when set, else the Stripe price the env id
   * points to), and the one currency to show.
   */
  getContractPricing: protectedProcedure.query(async ({ ctx }) => {
    if (!features.stripeEnabled) {
      return { enabled: false as const, defaultCurrency: "usd" as const, display: null };
    }
    const email = ctx.session.user.email;
    const customer = email
      ? await ctx.prisma.customer.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { id: true, metadata: true, stripeCustomerId: true },
        })
      : null;
    const requestHeaders = await headers();
    const locale = localeFromRequest(requestHeaders.get("cookie"));
    // One currency per visitor: their switch choice, else the account's
    // billing currency, else the region guess.
    const defaultCurrency = toBillingCurrency(
      resolveVisitorCurrencyFromHeaders(requestHeaders, preferredCurrency(customer?.metadata)),
    );
    const table = await getPriceTable();
    const shown = (currency: BillingCurrency) =>
      displayPrice("contract", currency, { stripeMinor: table?.contract[currency]?.amount, locale });
    return {
      enabled: true as const,
      defaultCurrency,
      display: { contract: { usd: shown("usd"), eur: shown("eur") } },
      hasBillingAccount: !!customer?.stripeCustomerId,
    };
  }),

  /** Whether this deal's contract is paid (a party to the deal only). */
  getDealPayment: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .query(async ({ ctx, input }) => {
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: { dealRoomId: input.dealRoomId, userId: ctx.session.user.id },
        select: { id: true },
      });
      if (!party) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
      if (!features.stripeEnabled) return { billing: false, paid: true, via: "billing_off" as const };

      const access = await isDealPaid(input.dealRoomId);
      if (access.paid) return { billing: true, paid: true, via: access.via };
      return { billing: true, paid: false, via: null };
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
