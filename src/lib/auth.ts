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
          // Upsert the trial user (create if not exists, otherwise return existing)
          const user = await prisma.user.upsert({
            where: { email: TRIAL_EMAIL },
            update: {}, // Don't update anything if exists
            create: {
              email: TRIAL_EMAIL,
              name: "Demo User",
              company: "Trial Account",
            },
          });

          // Return user object for JWT token
          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error("Trial auth error:", error);
          return null;
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
            subject: `Sign in to ${brand.name}`,
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                <h1 style="color: ${emailStyles.header.color}; background: ${emailStyles.header.background}; padding: 20px; margin: 0;">${brand.name}</h1>
                <div style="padding: 20px; background: #f5f5f5;">
                  <p>Click the button below to sign in to ${brand.name}:</p>
                  <a href="${url}" style="display: inline-block; background: ${emailStyles.button.background}; color: ${emailStyles.button.color}; padding: 12px 24px; text-decoration: none; font-weight: bold; margin: 20px 0;">Sign In</a>
                  <p style="color: #666; font-size: 14px;">If you didn't request this email, you can safely ignore it.</p>
                  <p style="color: #666; font-size: 12px;">Or copy this link: ${url}</p>
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
