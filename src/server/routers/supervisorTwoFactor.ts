import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  generateSupervisorSecret,
  generateSupervisorQRCode,
  verifySupervisorToken,
} from "@/lib/totp-supervisor";

export const supervisorTwoFactorRouter = createTRPCRouter({
  // Get 2FA status for current supervisor
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const email = ctx.session.user.email;
    if (!email) {
      return { isSupervisor: false, isSetup: false, isVerified: false };
    }

    const supervisor = await ctx.prisma.supervisor.findUnique({
      where: { email: email.toLowerCase() },
      include: { twoFactorSecret: true },
    });

    if (!supervisor || !supervisor.isActive) {
      return { isSupervisor: false, isSetup: false, isVerified: false };
    }

    return {
      isSupervisor: true,
      isSetup: !!supervisor.twoFactorSecret?.verified,
      isVerified: false, // Session verification handled separately via cookie
    };
  }),

  // Setup 2FA - generate new secret and QR code
  setup: protectedProcedure.mutation(async ({ ctx }) => {
    const email = ctx.session.user.email;
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const supervisor = await ctx.prisma.supervisor.findUnique({
      where: { email: email.toLowerCase() },
      include: { twoFactorSecret: true },
    });

    if (!supervisor || !supervisor.isActive) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only supervisors can setup 2FA",
      });
    }

    // Check if already has a verified secret
    if (supervisor.twoFactorSecret?.verified) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "2FA is already setup. Use verify endpoint to authenticate.",
      });
    }

    // Generate new secret
    const secret = generateSupervisorSecret(email);

    // Store or update the secret (unverified)
    await ctx.prisma.supervisorTwoFactor.upsert({
      where: { supervisorId: supervisor.id },
      create: {
        supervisorId: supervisor.id,
        secret,
        verified: false,
      },
      update: {
        secret,
        verified: false,
      },
    });

    // Generate QR code
    const qrCode = await generateSupervisorQRCode(secret, email);

    return { qrCode, secret };
  }),

  // Verify TOTP code (for initial setup or login)
  verify: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const email = ctx.session.user.email;
      if (!email) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      const supervisor = await ctx.prisma.supervisor.findUnique({
        where: { email: email.toLowerCase() },
        include: { twoFactorSecret: true },
      });

      if (!supervisor || !supervisor.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only supervisors can verify 2FA",
        });
      }

      if (!supervisor.twoFactorSecret) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "2FA not setup. Call setup first.",
        });
      }

      // Verify the token
      const isValid = verifySupervisorToken(supervisor.twoFactorSecret.secret, input.code);

      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid verification code",
        });
      }

      // Mark as verified if first time
      if (!supervisor.twoFactorSecret.verified) {
        await ctx.prisma.supervisorTwoFactor.update({
          where: { supervisorId: supervisor.id },
          data: { verified: true },
        });
      }

      return { success: true };
    }),
});
