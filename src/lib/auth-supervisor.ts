import { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { PrismaClient } from "@prisma/client";
import { createSupervisorAdapter } from "./supervisor-adapter";

// Create a dedicated prisma instance to avoid module resolution issues
const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

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
          await resend.emails.send({
            from: process.env.EMAIL_FROM || "onboarding@resend.dev",
            to: email,
            subject: "Sign in to Deal Room - Supervisor Portal",
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                <h1 style="color: #9333ea; background: #1c1f37; padding: 20px; margin: 0;">Deal Room - Supervisor Portal</h1>
                <div style="padding: 20px; background: #f5f5f5;">
                  <p>Click the button below to sign in to the Supervisor Portal:</p>
                  <a href="${supervisorUrl}" style="display: inline-block; background: #9333ea; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; margin: 20px 0;">Sign In as Supervisor</a>
                  <p style="color: #666; font-size: 14px;">If you didn't request this email, you can safely ignore it.</p>
                  <p style="color: #666; font-size: 12px;">Or copy this link: ${supervisorUrl}</p>
                </div>
              </div>
            `,
          });
        } catch (error) {
          console.error("Failed to send supervisor verification email:", error);
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
