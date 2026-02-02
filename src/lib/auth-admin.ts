import { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { PrismaClient } from "@prisma/client";
import { createAdminAdapter } from "./admin-adapter";

// Create a dedicated prisma instance to avoid module resolution issues
const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

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
          await resend.emails.send({
            from: process.env.EMAIL_FROM || "onboarding@resend.dev",
            to: email,
            subject: "Sign in to Deal Room - Platform Admin",
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                <h1 style="color: #ffffff; background: #1c1f37; padding: 20px; margin: 0;">Deal Room - Platform Admin</h1>
                <div style="padding: 20px; background: #f5f5f5;">
                  <p>Click the button below to sign in to the Platform Admin Portal:</p>
                  <a href="${adminUrl}" style="display: inline-block; background: #1c1f37; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; margin: 20px 0; border: 2px solid #000;">Sign In as Admin</a>
                  <p style="color: #666; font-size: 14px;">If you didn't request this email, you can safely ignore it.</p>
                  <p style="color: #666; font-size: 12px;">Or copy this link: ${adminUrl}</p>
                </div>
              </div>
            `,
          });
        } catch (error) {
          console.error("Failed to send admin verification email:", error);
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
      if (user?.email) {
        const admin = await prisma.platformAdmin.findUnique({
          where: { email: user.email.toLowerCase() },
        });
        if (admin) {
          token.adminId = admin.id;
          token.email = admin.email;
          token.name = admin.name;
        }
      }
      // On subsequent requests, ensure adminId is set if we have an email
      else if (token.email && !token.adminId) {
        const admin = await prisma.platformAdmin.findUnique({
          where: { email: (token.email as string).toLowerCase() },
        });
        if (admin) {
          token.adminId = admin.id;
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
