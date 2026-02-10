import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Resend } from "resend";
import prisma from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);
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
            subject: "Sign in to Deal Room",
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                <h1 style="color: #13e9d1; background: #1c1f37; padding: 20px; margin: 0;">Deal Room</h1>
                <div style="padding: 20px; background: #f5f5f5;">
                  <p>Click the button below to sign in to Deal Room:</p>
                  <a href="${url}" style="display: inline-block; background: #1c1f37; color: #13e9d1; padding: 12px 24px; text-decoration: none; font-weight: bold; margin: 20px 0;">Sign In</a>
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
