import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { getResend } from "@/lib/email";
import { brand } from "@/config/brand";
import { features } from "@/config/features";

const isProduction = process.env.NODE_ENV === "production";

// Build providers list based on brand/features
const providers: NextAuthOptions["providers"] = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
];

// Magic-link email provider (todo.law)
if (features.magicLinkAuth) {
  providers.push(
    EmailProvider({
      from: process.env.EMAIL_FROM,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        try {
          await getResend().emails.send({
            from: process.env.EMAIL_FROM || "onboarding@resend.dev",
            to: email,
            subject: `Sign in to DEALROOM`,
            html: `
              <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: ${brand.colors.background}; border-radius: 12px; overflow: hidden;">
                <div style="padding: 24px 24px 16px; border-bottom: 1px solid ${brand.colors.border};">
                  <span style="font-size: 20px; font-weight: 700; color: ${brand.colors.foreground}; letter-spacing: 0.05em;">DEALROOM</span>
                  <span style="font-size: 13px; color: ${brand.colors.muted}; margin-left: 10px;">Contract Negotiation</span>
                </div>
                <div style="padding: 32px 24px;">
                  <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Click the button below to sign in to your DEALROOM account:</p>
                  <a href="${url}" style="display: inline-block; background: ${brand.colors.primary}; color: ${brand.colors.background}; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Sign In to DEALROOM</a>
                  <p style="color: ${brand.colors.muted}; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">If you didn't request this email, you can safely ignore it.</p>
                </div>
                <div style="padding: 16px 24px; border-top: 1px solid ${brand.colors.border};">
                  <p style="color: #666666; font-size: 11px; margin: 0;">${brand.company}&#8482; &middot; DEALROOM &middot; <a href="https://${brand.appDomain}" style="color: ${brand.colors.primary}; text-decoration: none;">${brand.appDomain}</a></p>
                </div>
              </div>
            `,
          });
        } catch (error) {
          console.error("Failed to send verification email:", error);
          throw new Error("Failed to send verification email");
        }
      },
    })
  );
}

// Invite-code credentials provider (northend.law)
if (features.inviteCodeAuth) {
  providers.push(
    CredentialsProvider({
      id: "invite-code",
      name: "Invite Code",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Invite Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.code) return null;

        const email = credentials.email.trim().toLowerCase();
        const code = credentials.code.trim();

        // Find unused invite code
        const inviteCode = await prisma.inviteCode.findUnique({
          where: { code },
        });

        if (!inviteCode || inviteCode.usedByUserId) return null;

        // Find or create user
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: { email, emailVerified: new Date() },
          });
        }

        // Mark invite code as used
        await prisma.inviteCode.update({
          where: { id: inviteCode.id },
          data: { usedByUserId: user.id },
        });

        return { id: user.id, email: user.email, name: user.name };
      },
    })
  );
}

// E2E test credentials provider — only active when E2E_CREDENTIALS_SECRET is set
if (process.env.E2E_CREDENTIALS_SECRET) {
  providers.push(
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
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers,
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
        domain: isProduction ? brand.cookieDomain : undefined,
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
        domain: isProduction ? brand.cookieDomain : undefined,
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
        session.user.role = token.role ?? null;
      }
      return session;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        // Fetch role from DB on first sign-in
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        token.role = dbUser?.role ?? null;
      }
      // Refresh role when client calls update() after setRole mutation
      if (trigger === "update") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub! },
          select: { role: true },
        });
        token.role = dbUser?.role ?? null;
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
