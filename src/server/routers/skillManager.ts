// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Skill Manager Router
 *
 * tRPC routes for managing skill packages and licenses:
 * - List available/installed skills
 * - Install/uninstall skill packages
 * - Activate/deactivate licenses
 * - Check entitlements
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { defaultInstaller } from "../services/skills/installer";
import {
  activateLicense,
  deactivateLicense,
  deactivateById,
  activateOffline,
  getCustomerActivations,
  checkEntitlement,
  getCustomerEntitlements,
  getFingerprintData,
} from "../services/licensing";
import { isValidLicenseKeyFormat, LicenseFile } from "@/lib/crypto";

// Schema for license file
const LicenseFileSchema = z.object({
  licenseKey: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  skillId: z.string(),
  jurisdictions: z.array(z.string()),
  licenseType: z.enum(["TRIAL", "SUBSCRIPTION", "PERPETUAL"]),
  maxActivations: z.number().int().positive(),
  issuedAt: z.string(),
  expiresAt: z.string().optional(),
  signature: z.string(),
});

export const skillManagerRouter = createTRPCRouter({
  /**
   * List all premium skills for the marketplace.
   * Public endpoint with optional auth for entitlement status.
   */
  listMarketplace: publicProcedure.query(async ({ ctx }) => {
    const packages = await ctx.prisma.skillPackage.findMany({
      where: { isActive: true, isPremium: true },
      include: {
        contractTemplate: {
          select: {
            id: true,
            contractType: true,
            displayName: true,
            description: true,
            category: true,
            categoryLocalized: true,
            displayNameLocalized: true,
            descriptionLocalized: true,
          },
        },
        _count: { select: { entitlements: true } },
      },
      orderBy: { displayName: "asc" },
    });

    // Check entitlements if authenticated
    const entitledSkillIds = new Set<string>();
    const entitlementMap = new Map<
      string,
      { status: string; expiresAt: Date | null }
    >();

    if (ctx.session?.user?.email) {
      const customer = await ctx.prisma.customer.findFirst({
        where: { email: { equals: ctx.session.user.email, mode: "insensitive" } },
        include: {
          entitlements: {
            where: { skillPackageId: { in: packages.map((p) => p.id) } },
          },
        },
      });

      if (customer) {
        for (const e of customer.entitlements) {
          if (e.status === "ACTIVE") {
            entitledSkillIds.add(e.skillPackageId);
          }
          entitlementMap.set(e.skillPackageId, {
            status: e.status,
            expiresAt: e.expiresAt,
          });
        }
      }
    }

    return packages.map((pkg) => {
      const ent = entitlementMap.get(pkg.id);
      // Count clauses from the contract template relationship
      return {
        id: pkg.id,
        skillId: pkg.skillId,
        name: pkg.name,
        displayName: pkg.displayName,
        description: pkg.description,
        jurisdictions: pkg.jurisdictions,
        languages: pkg.languages,
        priceAmount: pkg.priceAmount,
        priceCurrency: pkg.priceCurrency,
        category: pkg.contractTemplate?.category ?? null,
        categoryLocalized: pkg.contractTemplate?.categoryLocalized ?? null,
        displayNameLocalized: pkg.contractTemplate?.displayNameLocalized ?? null,
        descriptionLocalized: pkg.contractTemplate?.descriptionLocalized ?? null,
        hasPackageFile: !!pkg.packageUrl,
        entitlementStatus: ent?.status ?? null,
        entitlementExpiresAt: ent?.expiresAt ?? null,
        isEntitled: entitledSkillIds.has(pkg.id),
      };
    });
  }),

  /**
   * List all installed skill packages.
   * Public endpoint - anyone can see what skills are available.
   */
  listInstalled: publicProcedure.query(async () => {
    const packages = await defaultInstaller.listInstalled();

    return packages.map((pkg) => ({
      id: pkg.id,
      skillId: pkg.skillId,
      name: pkg.name,
      displayName: pkg.displayName,
      version: pkg.version,
      jurisdictions: pkg.jurisdictions,
      languages: pkg.languages,
      isActive: pkg.isActive,
      installedAt: pkg.installedAt,
      contractTemplate: pkg.contractTemplate
        ? {
            id: pkg.contractTemplate.id,
            contractType: pkg.contractTemplate.contractType,
            displayName: pkg.contractTemplate.displayName,
          }
        : null,
      entitlementCount: pkg._count.entitlements,
    }));
  }),

  /**
   * Get details of a specific skill package.
   */
  getPackageDetails: protectedProcedure
    .input(z.object({ skillId: z.string() }))
    .query(async ({ input }) => {
      const details = await defaultInstaller.getPackageDetails(input.skillId);

      if (!details) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Skill package not found: ${input.skillId}`,
        });
      }

      return details;
    }),

  /**
   * List skills the current customer has access to (based on entitlements).
   */
  listAvailable: protectedProcedure.query(async ({ ctx }) => {
    // Find customer by email (in a real app, User would have customerId)
    const customer = await ctx.prisma.customer.findFirst({
      where: {
        email: { equals: ctx.session.user.email || undefined, mode: "insensitive" },
      },
    });

    if (!customer) {
      // No customer record - return empty or all free skills
      const freeSkills = await ctx.prisma.skillPackage.findMany({
        where: {
          isActive: true,
          // Skills without any entitlements are considered free
          entitlements: { none: {} },
        },
      });

      return freeSkills.map((pkg) => ({
        skillId: pkg.skillId,
        displayName: pkg.displayName,
        jurisdictions: pkg.jurisdictions,
        entitled: true,
        licenseType: "FREE" as const,
      }));
    }

    // Get customer's entitlements
    const entitlements = await getCustomerEntitlements(customer.id);

    return entitlements.map((e) => ({
      skillId: e.skillId,
      displayName: e.displayName,
      jurisdictions: e.jurisdictions,
      entitled: e.status === "ACTIVE",
      licenseType: e.licenseType,
      expiresAt: e.expiresAt,
      activationCount: e.activationCount,
      maxActivations: e.maxActivations,
    }));
  }),

  /**
   * Activate a license key on this machine.
   */
  activate: protectedProcedure
    .input(
      z.object({
        licenseKey: z.string().refine(isValidLicenseKeyFormat, {
          message: "Invalid license key format (expected: LIC-XXXX-XXXX-XXXX-XXXX)",
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find customer by email
      const customer = await ctx.prisma.customer.findFirst({
        where: { email: { equals: ctx.session.user.email || undefined, mode: "insensitive" } },
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No customer account found. Please contact support.",
        });
      }

      const result = await activateLicense(input.licenseKey, customer.id);

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Activation failed",
        });
      }

      return {
        success: true,
        activationId: result.activationId,
        skillId: result.skillId,
        skillName: result.skillName,
        jurisdictions: result.jurisdictions,
        expiresAt: result.expiresAt,
      };
    }),

  /**
   * Activate using an offline license file.
   */
  activateOffline: protectedProcedure
    .input(z.object({ licenseFile: LicenseFileSchema }))
    .mutation(async ({ ctx, input }) => {
      // Find customer by email
      const customer = await ctx.prisma.customer.findFirst({
        where: { email: { equals: ctx.session.user.email || undefined, mode: "insensitive" } },
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No customer account found",
        });
      }

      const result = await activateOffline(
        input.licenseFile as LicenseFile,
        { id: customer.id, email: customer.email }
      );

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Offline activation failed",
        });
      }

      return {
        success: true,
        activationId: result.activationId,
        skillId: result.skillId,
        skillName: result.skillName,
        jurisdictions: result.jurisdictions,
        expiresAt: result.expiresAt,
      };
    }),

  /**
   * Deactivate a license on this machine.
   */
  deactivate: protectedProcedure
    .input(z.object({ licenseKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.findFirst({
        where: { email: { equals: ctx.session.user.email || undefined, mode: "insensitive" } },
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No customer account found",
        });
      }

      const result = await deactivateLicense(input.licenseKey, customer.id);

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Deactivation failed",
        });
      }

      return { success: true };
    }),

  /**
   * Deactivate a specific activation by ID (for remote deactivation).
   */
  deactivateById: protectedProcedure
    .input(z.object({ activationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.findFirst({
        where: { email: { equals: ctx.session.user.email || undefined, mode: "insensitive" } },
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No customer account found",
        });
      }

      const result = await deactivateById(input.activationId, customer.id);

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Deactivation failed",
        });
      }

      return { success: true };
    }),

  /**
   * Check entitlement for a specific skill and jurisdiction.
   */
  checkEntitlement: protectedProcedure
    .input(
      z.object({
        skillId: z.string(),
        jurisdiction: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.findFirst({
        where: { email: { equals: ctx.session.user.email || undefined, mode: "insensitive" } },
      });

      if (!customer) {
        return {
          entitled: false,
          reason: "No customer account found",
        };
      }

      return checkEntitlement(customer.id, input.skillId, input.jurisdiction);
    }),

  /**
   * Get all activations for the current customer.
   */
  listActivations: protectedProcedure.query(async ({ ctx }) => {
    const customer = await ctx.prisma.customer.findFirst({
      where: { email: { equals: ctx.session.user.email || undefined, mode: "insensitive" } },
    });

    if (!customer) {
      return [];
    }

    return getCustomerActivations(customer.id);
  }),

  /**
   * Get machine fingerprint for offline activation.
   */
  getFingerprint: protectedProcedure.query(async () => {
    return getFingerprintData();
  }),

  /**
   * Generate activation request for offline licensing.
   */
  generateActivationRequest: protectedProcedure
    .input(z.object({ skillId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.findFirst({
        where: { email: { equals: ctx.session.user.email || undefined, mode: "insensitive" } },
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No customer account found",
        });
      }

      const fingerprint = getFingerprintData();

      return {
        type: "LICENSE_REQUEST",
        version: "1.0",
        customerId: customer.id,
        customerEmail: customer.email,
        skillId: input.skillId,
        machine: fingerprint,
        requestedAt: new Date().toISOString(),
      };
    }),
});
