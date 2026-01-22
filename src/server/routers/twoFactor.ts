import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  generateSecret,
  generateQRCode,
  verifyToken,
  isAdminEmail,
} from "@/lib/totp";

export const twoFactorRouter = createTRPCRouter({
  // Get 2FA status for current user
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const email = ctx.session.user.email;
    const isAdmin = isAdminEmail(email);

    if (!isAdmin) {
      return { isAdmin: false, isSetup: false, isVerified: false };
    }

    const twoFactorSecret = await ctx.prisma.twoFactorSecret.findUnique({
      where: { userId: ctx.session.user.id },
    });

    return {
      isAdmin: true,
      isSetup: !!twoFactorSecret?.verified,
      isVerified: false, // Session verification handled separately via cookie
    };
  }),

  // Setup 2FA - generate new secret and QR code
  setup: protectedProcedure.mutation(async ({ ctx }) => {
    const email = ctx.session.user.email;
    if (!isAdminEmail(email)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins can setup 2FA",
      });
    }

    // Check if already has a verified secret
    const existing = await ctx.prisma.twoFactorSecret.findUnique({
      where: { userId: ctx.session.user.id },
    });

    if (existing?.verified) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "2FA is already setup. Use verify endpoint to authenticate.",
      });
    }

    // Generate new secret
    const secret = generateSecret(email!);

    // Store or update the secret (unverified)
    await ctx.prisma.twoFactorSecret.upsert({
      where: { userId: ctx.session.user.id },
      create: {
        userId: ctx.session.user.id,
        secret,
        verified: false,
      },
      update: {
        secret,
        verified: false,
      },
    });

    // Generate QR code
    const qrCode = await generateQRCode(secret, email!);

    return { qrCode, secret };
  }),

  // Verify TOTP code (for initial setup or login)
  verify: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const email = ctx.session.user.email;
      if (!isAdminEmail(email)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can verify 2FA",
        });
      }

      const twoFactorSecret = await ctx.prisma.twoFactorSecret.findUnique({
        where: { userId: ctx.session.user.id },
      });

      if (!twoFactorSecret) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "2FA not setup. Call setup first.",
        });
      }

      // Verify the token
      const isValid = verifyToken(twoFactorSecret.secret, input.code);

      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid verification code",
        });
      }

      // Mark as verified if first time
      if (!twoFactorSecret.verified) {
        await ctx.prisma.twoFactorSecret.update({
          where: { userId: ctx.session.user.id },
          data: { verified: true },
        });
      }

      return { success: true };
    }),
});
