// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { PrismaClient } from "@prisma/client";
import { createSupervisorAdapter } from "./supervisor-adapter";
import { brand } from "@/config/brand";
import { createLogger } from "@/lib/logger";

const logger = createLogger("auth-supervisor");

// Create a dedicated prisma instance to avoid module resolution issues
const prisma = new PrismaClient();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Supervisor authentication uses email-only (magic link)
// This is a separate NextAuth instance for the supervisor portal
// Uses a minimal adapter for verification tokens only
export const supervisorAuthOptions: NextAuthOptions = {
  adapter: createSupervisorAdapter(prisma),
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        // Check if the email belongs to an active supervisor
        const supervisor = await prisma.supervisor.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!supervisor || !supervisor.isActive) {
          throw new Error("Not authorized as a supervisor");
        }

        // Rewrite the callback URL to use the supervisor auth path
        // NextAuth generates /api/auth/callback/email but we need /api/auth/supervisor/callback/email
        const supervisorUrl = url.replace("/api/auth/callback/", "/api/auth/supervisor/callback/");

        try {
          await resend!.emails.send({
            from: `DEALROOM <${process.env.EMAIL_FROM || "noreply@todo.law"}>`,
            to: email,
            subject: `Sign in to DEALROOM - Supervisor Portal`,
            html: `
              <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: ${brand.colors.background}; border-radius: 12px; overflow: hidden;">
                <div style="padding: 24px 24px 16px; border-bottom: 1px solid ${brand.colors.border};">
                  <span style="font-size: 20px; font-weight: 700; color: ${brand.colors.foreground}; letter-spacing: 0.05em;">DEALROOM</span>
                  <span style="font-size: 13px; color: ${brand.colors.muted}; margin-left: 10px;">Supervisor Portal</span>
                </div>
                <div style="padding: 32px 24px;">
                  <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Click the button below to sign in to the Supervisor Portal:</p>
                  <a href="${supervisorUrl}" style="display: inline-block; background: ${brand.colors.primary}; color: ${brand.colors.background}; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Sign In as Supervisor</a>
                  <p style="color: ${brand.colors.muted}; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">If you didn't request this email, you can safely ignore it.</p>
                </div>
                <div style="padding: 16px 24px; border-top: 1px solid ${brand.colors.border};">
                  <p style="color: #666666; font-size: 11px; margin: 0;">${brand.company}&#8482; &middot; DEALROOM &middot; <a href="https://${brand.appDomain}" style="color: ${brand.colors.primary}; text-decoration: none;">${brand.appDomain}</a></p>
                </div>
              </div>
            `,
          });
        } catch (error) {
          logger.error("Failed to send supervisor verification email", { err: String(error) });
          throw new Error("Failed to send verification email");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      // Only allow sign-in if the email belongs to an active supervisor
      if (!user.email) return false;

      const supervisor = await prisma.supervisor.findUnique({
        where: { email: user.email.toLowerCase() },
      });

      return !!supervisor?.isActive;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (token.supervisorId) {
          (session.user as { id: string; supervisorId?: string }).supervisorId = token.supervisorId as string;
        }
        if (token.email) {
          session.user.email = token.email as string;
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      // On initial sign-in, user object is present
      if (user?.email) {
        const supervisor = await prisma.supervisor.findUnique({
          where: { email: user.email.toLowerCase() },
        });
        if (supervisor) {
          token.supervisorId = supervisor.id;
          token.email = supervisor.email;
          token.name = supervisor.name;
        }
      }
      // On subsequent requests, ensure supervisorId is set if we have an email
      else if (token.email && !token.supervisorId) {
        const supervisor = await prisma.supervisor.findUnique({
          where: { email: (token.email as string).toLowerCase() },
        });
        if (supervisor) {
          token.supervisorId = supervisor.id;
          token.name = supervisor.name;
        }
      }
      return token;
    },
  },
  pages: {
    signIn: "/supervise/sign-in",
    verifyRequest: "/supervise/verify-request",
    error: "/supervise/error",
  },
  cookies: {
    sessionToken: {
      name: "supervisor_session",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: "supervisor_callback",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: "supervisor_csrf",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
};
