import { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Resend } from "resend";
import prisma from "@/lib/prisma";
import { brand, getEmailStyles } from "@/config/brand";

const resend = new Resend(process.env.RESEND_API_KEY);

// Trial user email - creates a demo account for testing
const TRIAL_EMAIL = "demo@trial.dealroom.app";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    // Trial/Demo access - no credentials needed
    CredentialsProvider({
      id: "trial",
      name: "Trial Access",
      credentials: {},
      async authorize() {
        try {
          // Try to find or create trial user in database
          const user = await prisma.user.upsert({
            where: { email: TRIAL_EMAIL },
            update: {},
            create: {
              email: TRIAL_EMAIL,
              name: "Demo User",
              company: "Trial Account",
            },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error("Trial auth DB error, using fallback:", error);
          // Fallback: return a static trial user (won't persist but allows UI exploration)
          return {
            id: "trial-demo-user",
            email: TRIAL_EMAIL,
            name: "Demo User",
          };
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    EmailProvider({
      from: process.env.EMAIL_FROM,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        const emailStyles = getEmailStyles();
        try {
          await resend.emails.send({
            from: process.env.EMAIL_FROM || "onboarding@resend.dev",
            to: email,
            subject: `Sign in to DEALROOM`,
            html: `
              <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: ${brand.colors.background}; border-radius: 12px; overflow: hidden;">
                <div style="padding: 24px 24px 16px; border-bottom: 1px solid ${brand.colors.border};">
                  <span style="font-size: 20px; font-weight: 700; color: ${brand.colors.foreground}; letter-spacing: 0.05em;">DEALROOM</span>
                  <span style="font-size: 13px; color: ${brand.colors.muted}; margin-left: 10px;">${brand.tagline}</span>
                </div>
                <div style="padding: 32px 24px;">
                  <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Click the button below to sign in to your DEALROOM account:</p>
                  <a href="${url}" style="display: inline-block; background: ${brand.colors.primary}; color: ${brand.colors.background}; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Sign In to DEALROOM</a>
                  <p style="color: ${brand.colors.muted}; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">If you didn't request this email, you can safely ignore it.</p>
                </div>
                <div style="padding: 16px 24px; border-top: 1px solid ${brand.colors.border};">
                  <p style="color: #666666; font-size: 11px; margin: 0;">TODO.LAW\u2122 \u00b7 DEALROOM \u00b7 <a href="https://dealroom.todo.law" style="color: ${brand.colors.primary}; text-decoration: none;">dealroom.todo.law</a></p>
                </div>
              </div>
            `,
          });
        } catch (error) {
          console.error("Failed to send verification email:", error);
          throw new Error("Failed to send verification email");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
        domain: process.env.NODE_ENV === "production" ? brand.cookieDomain : undefined,
      },
    },
    callbackUrl: {
      name: `__Secure-next-auth.callback-url`,
      options: {
        sameSite: "lax",
        path: "/",
        secure: true,
        domain: process.env.NODE_ENV === "production" ? brand.cookieDomain : undefined,
      },
    },
    csrfToken: {
      name: `__Host-next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
      },
    },
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/verify-request",
    error: "/auth-error",
  },
};
