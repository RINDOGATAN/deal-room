// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Settings, API keys: a signed-in person's own agent API keys.
 *
 * The person's account is the `Customer` with their e-mail (the same link
 * `getOrCreateStripeCustomer` and the billing router use), so the keys
 * they create here spend the same credits they buy here. Every procedure
 * is scoped to that one customer: a key id from another account reads as
 * not found. Keys come from the generator the admin path uses; only the
 * hash and the prefix are stored, and the raw key is returned once, by
 * `create`. Creation and revocation are written to the audit log.
 *
 * Exists only where `features.selfServiceApiKeys` is on (agent API and
 * billing on: hosted). On the kit, keys stay with the platform administrator.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { features } from "@/config/features";
import { createLogger } from "@/lib/logger";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import {
  MAX_ACTIVE_KEYS_PER_CUSTOMER,
  SELF_SERVICE_SCOPES,
} from "@/lib/api-key-scopes";
import { API_KEY_PUBLIC_SELECT, activeKeyWhere, generateApiKey } from "../services/api-keys";
import { checkPublicRateLimit } from "../middleware/public-rate-limit";

const logger = createLogger("api-keys");

/** How many keys the list shows (newest first, revoked included). */
const LIST_LIMIT = 50;

function requireFeature() {
  if (!features.selfServiceApiKeys) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Not available" });
  }
}

function requireEmail(email: string | null | undefined): string {
  if (!email) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Your account has no e-mail address" });
  }
  return email;
}

async function findCustomer(prisma: ExtendedPrismaClient, email: string) {
  return prisma.customer.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
}

/** The person's customer, created on their first key (no Stripe call). */
async function findOrCreateCustomer(
  prisma: ExtendedPrismaClient,
  email: string,
  name: string | null | undefined,
): Promise<{ id: string }> {
  const existing = await findCustomer(prisma, email);
  if (existing) return existing;
  try {
    return await prisma.customer.create({
      data: { name: name || email, email, type: "SAAS" },
      select: { id: true },
    });
  } catch (err) {
    // Two first requests at once: the other one created it.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await findCustomer(prisma, email);
      if (again) return again;
    }
    throw err;
  }
}

export const apiKeysRouter = createTRPCRouter({
  /** The person's keys (never a hash), the active-key limit, the credits. */
  overview: protectedProcedure.query(async ({ ctx }) => {
    requireFeature();
    const email = requireEmail(ctx.session.user.email);
    const customer = await findCustomer(ctx.prisma, email);
    if (!customer) {
      return {
        keys: [],
        activeCount: 0,
        maxActive: MAX_ACTIVE_KEYS_PER_CUSTOMER,
        balance: 0,
      };
    }
    const [keys, activeCount, credit] = await Promise.all([
      ctx.prisma.apiKey.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        take: LIST_LIMIT,
        select: API_KEY_PUBLIC_SELECT,
      }),
      ctx.prisma.apiKey.count({ where: activeKeyWhere(customer.id) }),
      ctx.prisma.customerCredit.findUnique({
        where: { customerId: customer.id },
        select: { balance: true },
      }),
    ]);
    const now = new Date();
    return {
      keys: keys.map((k) => ({
        ...k,
        status: !k.isActive
          ? ("revoked" as const)
          : k.expiresAt && k.expiresAt <= now
            ? ("expired" as const)
            : ("active" as const),
      })),
      activeCount,
      maxActive: MAX_ACTIVE_KEYS_PER_CUSTOMER,
      balance: credit?.balance ?? 0,
    };
  }),

  /** Create a key. The full key is in this response and nowhere else. */
  create: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1, "Name is required").max(60) }))
    .mutation(async ({ ctx, input }) => {
      requireFeature();
      const email = requireEmail(ctx.session.user.email);
      const userId = ctx.session.user.id;

      const limit = await checkPublicRateLimit("api-key-create", userId);
      if (!limit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many keys created. Please wait and try again.",
        });
      }

      const customer = await findOrCreateCustomer(ctx.prisma, email, ctx.session.user.name);
      const activeCount = await ctx.prisma.apiKey.count({ where: activeKeyWhere(customer.id) });
      if (activeCount >= MAX_ACTIVE_KEYS_PER_CUSTOMER) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `You can have at most ${MAX_ACTIVE_KEYS_PER_CUSTOMER} active keys. Revoke one first.`,
        });
      }

      const { rawKey, keyHash, keyPrefix } = generateApiKey();
      const apiKey = await ctx.prisma.apiKey.create({
        data: {
          customerId: customer.id,
          name: input.name,
          keyHash,
          keyPrefix,
          scopes: SELF_SERVICE_SCOPES,
        },
        select: API_KEY_PUBLIC_SELECT,
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId,
          action: "API_KEY_CREATED",
          details: {
            apiKeyId: apiKey.id,
            customerId: customer.id,
            keyPrefix: apiKey.keyPrefix,
            name: apiKey.name,
            via: "settings",
          },
          ipAddress: ctx.clientIp,
        },
      });
      logger.info("api key created", { apiKeyId: apiKey.id, customerId: customer.id });

      return { ...apiKey, key: rawKey };
    }),

  /** Revoke one of the person's own keys. Other accounts' keys: not found. */
  revoke: protectedProcedure
    .input(z.object({ apiKeyId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      requireFeature();
      const email = requireEmail(ctx.session.user.email);
      const customer = await findCustomer(ctx.prisma, email);
      const apiKey = customer
        ? await ctx.prisma.apiKey.findFirst({
            where: { id: input.apiKeyId, customerId: customer.id },
            select: { id: true, isActive: true, keyPrefix: true },
          })
        : null;
      if (!customer || !apiKey) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
      }
      if (!apiKey.isActive) return { success: true, alreadyRevoked: true };

      // The customer id stays in the filter, so the write itself cannot
      // reach another account's key.
      await ctx.prisma.apiKey.updateMany({
        where: { id: apiKey.id, customerId: customer.id },
        data: { isActive: false },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.session.user.id,
          action: "API_KEY_REVOKED",
          details: {
            apiKeyId: apiKey.id,
            customerId: customer.id,
            keyPrefix: apiKey.keyPrefix,
            via: "settings",
          },
          ipAddress: ctx.clientIp,
        },
      });
      logger.info("api key revoked", { apiKeyId: apiKey.id, customerId: customer.id });

      return { success: true, alreadyRevoked: false };
    }),
});
