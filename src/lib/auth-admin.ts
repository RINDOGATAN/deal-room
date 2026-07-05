import { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { PrismaClient } from "@prisma/client";
import { createAdminAdapter } from "./admin-adapter";
import { brand } from "@/config/brand";
import { createLogger } from "@/lib/logger";

const logger = createLogger("auth-admin");

// Create a dedicated prisma instance to avoid module resolution issues
const prisma = new PrismaClient();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Platform Admin authentication uses email-only (magic link)
// This is a separate NextAuth instance for the admin portal
// Uses a minimal adapter for verification tokens only
export const adminAuthOptions: NextAuthOptions = {
  adapter: createAdminAdapter(prisma),
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        // Check if the email belongs to an active platform admin
        const admin = await prisma.platformAdmin.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!admin || !admin.isActive) {
          throw new Error("Not authorized as a platform administrator");
        }

        // Rewrite the callback URL to use the admin auth path
        // NextAuth generates /api/auth/callback/email but we need /api/auth/admin/callback/email
        const adminUrl = url.replace("/api/auth/callback/", "/api/auth/admin/callback/");

        try {
          await resend!.emails.send({
            from: `DEALROOM <${process.env.EMAIL_FROM || "noreply@todo.law"}>`,
            to: email,
            subject: `Sign in to DEALROOM - Platform Admin`,
            html: `
              <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: ${brand.colors.background}; border-radius: 12px; overflow: hidden;">
                <div style="padding: 24px 24px 16px; border-bottom: 1px solid ${brand.colors.border};">
                  <span style="font-size: 20px; font-weight: 700; color: ${brand.colors.foreground}; letter-spacing: 0.05em;">DEALROOM</span>
                  <span style="font-size: 13px; color: ${brand.colors.muted}; margin-left: 10px;">Platform Admin</span>
                </div>
                <div style="padding: 32px 24px;">
                  <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Click the button below to sign in to the Platform Admin Portal:</p>
                  <a href="${adminUrl}" style="display: inline-block; background: ${brand.colors.primary}; color: ${brand.colors.background}; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Sign In as Admin</a>
                  <p style="color: ${brand.colors.muted}; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">If you didn't request this email, you can safely ignore it.</p>
                </div>
                <div style="padding: 16px 24px; border-top: 1px solid ${brand.colors.border};">
                  <p style="color: #666666; font-size: 11px; margin: 0;">${brand.company}&#8482; &middot; DEALROOM &middot; <a href="https://${brand.appDomain}" style="color: ${brand.colors.primary}; text-decoration: none;">${brand.appDomain}</a></p>
                </div>
              </div>
            `,
          });
        } catch (error) {
          logger.error("Failed to send admin verification email", { err: String(error) });
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
      // Only allow sign-in if the email belongs to an active platform admin
      if (!user.email) return false;

      const admin = await prisma.platformAdmin.findUnique({
        where: { email: user.email.toLowerCase() },
      });

      return !!admin?.isActive;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (token.adminId) {
          (session.user as { id: string; adminId?: string }).adminId = token.adminId as string;
        }
        if (token.email) {
          session.user.email = token.email as string;
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      // On initial sign-in, user object is present
      if (user) {
        // The user object from our adapter has the admin's id as user.id
        // and should have email, but let's handle both cases
        const admin = user.email
          ? await prisma.platformAdmin.findUnique({
              where: { email: user.email.toLowerCase() },
            })
          : await prisma.platformAdmin.findUnique({
              where: { id: user.id },
            });

        if (admin) {
          token.adminId = admin.id;
          token.email = admin.email;
          token.name = admin.name;
        }
      }
      // On subsequent requests, ensure adminId is set
      else if (token.sub && !token.adminId) {
        // Try to look up by ID (token.sub) or email
        const admin = token.email
          ? await prisma.platformAdmin.findUnique({
              where: { email: (token.email as string).toLowerCase() },
            })
          : await prisma.platformAdmin.findUnique({
              where: { id: token.sub },
            });

        if (admin) {
          token.adminId = admin.id;
          token.email = admin.email;
          token.name = admin.name;
        }
      }

      return token;
    },
  },
  pages: {
    signIn: "/admin/sign-in",
    verifyRequest: "/admin/verify-request",
    error: "/admin/error",
  },
  cookies: {
    sessionToken: {
      name: "admin_session",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: "admin_callback",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: "admin_csrf",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
};
