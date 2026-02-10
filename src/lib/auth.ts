import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email";
const isProduction = process.env.NODE_ENV === "production";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    EmailProvider({
      from: process.env.EMAIL_FROM,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        try {
          await resend.emails.send({
            from: process.env.EMAIL_FROM || "onboarding@resend.dev",
            to: email,
            subject: "Sign in to DEALROOM",
            html: `
              <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; overflow: hidden;">
                <div style="padding: 24px 24px 16px; border-bottom: 1px solid #2a2a2a;">
                  <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">DEALROOM</span>
                  <span style="font-size: 13px; color: #a6a6a6; margin-left: 10px;">Contract Negotiation</span>
                </div>
                <div style="padding: 32px 24px;">
                  <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Click the button below to sign in to your DEALROOM account:</p>
                  <a href="${url}" style="display: inline-block; background: #53aecc; color: #1a1a1a; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Sign In to DEALROOM</a>
                  <p style="color: #a6a6a6; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">If you didn't request this email, you can safely ignore it.</p>
                </div>
                <div style="padding: 16px 24px; border-top: 1px solid #2a2a2a;">
                  <p style="color: #666666; font-size: 11px; margin: 0;">TODO.LAW&#8482; &middot; DEALROOM &middot; <a href="https://dealroom.todo.law" style="color: #53aecc; text-decoration: none;">dealroom.todo.law</a></p>
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
    // E2E test credentials provider — only active when E2E_CREDENTIALS_SECRET is set
    ...(process.env.E2E_CREDENTIALS_SECRET
      ? [
          CredentialsProvider({
            id: "e2e-credentials",
            name: "E2E Test",
            credentials: {
              email: { type: "email" },
              secret: { type: "password" },
            },
            async authorize(credentials) {
              if (
                !credentials?.secret ||
                credentials.secret !== process.env.E2E_CREDENTIALS_SECRET
              ) {
                return null;
              }
              const email = credentials.email;
              let user = await prisma.user.findUnique({ where: { email } });
              if (!user) {
                user = await prisma.user.create({
                  data: { email, emailVerified: new Date() },
                });
              }
              return { id: user.id, email: user.email, name: user.name };
            },
          }),
        ]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: isProduction
        ? `__Secure-next-auth.session-token`
        : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
        domain: isProduction ? ".todo.law" : undefined,
      },
    },
    callbackUrl: {
      name: isProduction
        ? `__Secure-next-auth.callback-url`
        : `next-auth.callback-url`,
      options: {
        sameSite: "lax",
        path: "/",
        secure: isProduction,
        domain: isProduction ? ".todo.law" : undefined,
      },
    },
    csrfToken: {
      name: isProduction
        ? `__Host-next-auth.csrf-token`
        : `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
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
