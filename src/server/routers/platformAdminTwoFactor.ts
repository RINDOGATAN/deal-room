import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  generateAdminSecret,
  generateAdminQRCode,
  verifyAdminToken,
} from "@/lib/totp-admin";

export const platformAdminTwoFactorRouter = createTRPCRouter({
  // Get 2FA status for current platform admin
  getStatus: adminProcedure.query(async ({ ctx }) => {
    const email = ctx.adminSession.email;

    const admin = await ctx.prisma.platformAdmin.findUnique({
      where: { email: email.toLowerCase() },
      include: { twoFactorSecret: true },
    });

    if (!admin || !admin.isActive) {
      return { isAdmin: false, isSetup: false, isVerified: false };
    }

    return {
      isAdmin: true,
      isSetup: !!admin.twoFactorSecret?.verified,
      isVerified: false, // Session verification handled separately via cookie
    };
  }),

  // Setup 2FA - generate new secret and QR code
  setup: adminProcedure.mutation(async ({ ctx }) => {
    const email = ctx.adminSession.email;

    const admin = await ctx.prisma.platformAdmin.findUnique({
      where: { email: email.toLowerCase() },
      include: { twoFactorSecret: true },
    });

    if (!admin || !admin.isActive) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only platform admins can setup 2FA",
      });
    }

    // Check if already has a verified secret
    if (admin.twoFactorSecret?.verified) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "2FA is already setup. Use verify endpoint to authenticate.",
      });
    }

    // Generate new secret
    const secret = generateAdminSecret(email);

    // Store or update the secret (unverified)
    await ctx.prisma.adminTwoFactor.upsert({
      where: { adminId: admin.id },
      create: {
        adminId: admin.id,
        secret,
        verified: false,
      },
      update: {
        secret,
        verified: false,
      },
    });

    // Generate QR code
    const qrCode = await generateAdminQRCode(secret, email);

    return { qrCode, secret };
  }),

  // Verify TOTP code (for initial setup or login)
  verify: adminProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const email = ctx.adminSession.email;

      const admin = await ctx.prisma.platformAdmin.findUnique({
        where: { email: email.toLowerCase() },
        include: { twoFactorSecret: true },
      });

      if (!admin || !admin.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admins can verify 2FA",
        });
      }

      if (!admin.twoFactorSecret) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "2FA not setup. Call setup first.",
        });
      }

      // Verify the token
      const isValid = verifyAdminToken(admin.twoFactorSecret.secret, input.code);

      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid verification code",
        });
      }

      // Mark as verified if first time
      if (!admin.twoFactorSecret.verified) {
        await ctx.prisma.adminTwoFactor.update({
          where: { adminId: admin.id },
          data: { verified: true },
        });
      }

      return { success: true };
    }),
});
