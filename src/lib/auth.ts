// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { getResend } from "@/lib/email";
import { brand } from "@/config/brand";
import { features } from "@/config/features";
import { isTesterEmail } from "@/lib/tester";
import { verifyWorkspacePassphrase } from "@/lib/workspace-passphrase";
import { createLogger } from "@/lib/logger";

const logger = createLogger("auth");

const isProduction =
  process.env.NODE_ENV === "production" &&
  (process.env.NEXTAUTH_URL?.startsWith("https://") ?? true);

// Cross-app SSO: the cloud deployment shares its session cookie across
// *.todo.law (brand.cookieDomain). Sovereign/self-hosted deployments set
// AUTH_COOKIE_DOMAIN="" in the environment to fall back to a host-only
// cookie — the .todo.law domain is a cloud-deployment concern only.
const cookieDomain =
  process.env.AUTH_COOKIE_DOMAIN !== undefined
    ? process.env.AUTH_COOKIE_DOMAIN || undefined
    : isProduction
      ? brand.cookieDomain
      : undefined;

// Build providers list based on brand/features.
// Google OAuth only when configured — sovereign bundles run without it.
const providers: NextAuthOptions["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

// Local credentials login for sovereign/self-hosted deployments
// (NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true): email-only find-or-create, no
// external OAuth or mailer. Only safe behind the firm's own network —
// never enable on an internet-facing instance.
if (features.localAuth) {
  providers.push(
    CredentialsProvider({
      id: "local",
      name: "Local Login",
      credentials: {
        email: { label: "Email", type: "email" },
        passphrase: { label: "Workspace passphrase", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        if (!email) return null;

        // Optional workspace passphrase gate. Read at call time (runtime
        // env, NOT NEXT_PUBLIC) so the operator can set or rotate it without
        // a rebuild. Unset/empty keeps today's behaviour exactly — an
        // update never locks an existing deployment out.
        const required = (process.env.WORKSPACE_PASSPHRASE ?? "").trim();
        if (required) {
          if (!credentials?.passphrase) return null;
          if (!verifyWorkspacePassphrase(credentials.passphrase, required)) {
            return null;
          }
        }

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

// Magic-link email provider (todo.law)
if (features.magicLinkAuth) {
  providers.push(
    EmailProvider({
      from: process.env.EMAIL_FROM,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        try {
          await getResend().emails.send({
            from: `DEALROOM <${process.env.EMAIL_FROM || "noreply@todo.law"}>`,
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
          logger.error("Failed to send verification email", { err: String(error) });
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

// Tester quick-access — production-safe fictitious users for journey testing.
// Only the emails in TESTER_EMAILS are accepted; the env var is the activation
// switch. No password needed; the allowlist is the gate. Set
// `TESTER_MODE_ENABLED=true` (server) and `NEXT_PUBLIC_TESTER_MODE=true`
// (client) on Vercel to enable, unset to disable.
if (process.env.TESTER_MODE_ENABLED === "true") {
  providers.push(
    CredentialsProvider({
      id: "tester",
      name: "Tester Quick Access",
      credentials: {
        email: { type: "email" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        if (!email || !isTesterEmail(email)) {
          return null;
        }
        // Persona-specific defaults so the dashboard chrome matches the
        // intent of each tester (the third nav slot is different for
        // lawyers vs founders/business owners).
        const isLawyer = email.startsWith("tester-lawyer");
        const name = email.startsWith("tester-startup")
          ? "Tester Startup Founder"
          : isLawyer
            ? "Tester Lawyer"
            : "Tester Business Owner";
        const role = isLawyer ? "LAWYER" : "BUSINESS_OWNER";

        // Upsert each sign-in: existing tester rows may pre-date this
        // logic and miss the isLawyer / role flags, which leaves the
        // lawyer-tester looking like a business owner in the nav.
        const user = await prisma.user.upsert({
          where: { email },
          create: {
            email,
            name,
            emailVerified: new Date(),
            isLawyer,
            role,
          },
          update: { isLawyer, role },
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

// Cookie naming: browsers scope cookies per host, NOT per port, and the
// self-hosted suite runs all three apps on localhost with one shared
// NEXTAUTH_SECRET. With the NextAuth default names, signing in to a sibling
// app (DPO Central, AI Sentinel) overwrites this app's session cookie with a
// token whose user id only exists in the sibling's database — every DB write
// then dies on a foreign-key violation. Scope our cookies with an app prefix
// on the local-auth posture (the convention AI Sentinel already uses). Hosted
// keeps the default names, which the *.todo.law cross-app SSO cookie expects.
const cookiePrefix = features.localAuth ? "dealroom." : "next-auth.";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers,
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: isProduction
        ? `__Secure-${cookiePrefix}session-token`
        : `${cookiePrefix}session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
        domain: cookieDomain,
      },
    },
    callbackUrl: {
      name: isProduction
        ? `__Secure-${cookiePrefix}callback-url`
        : `${cookiePrefix}callback-url`,
      options: {
        sameSite: "lax",
        path: "/",
        secure: isProduction,
        domain: cookieDomain,
      },
    },
    csrfToken: {
      name: isProduction
        ? `__Host-${cookiePrefix}csrf-token`
        : `${cookiePrefix}csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
  },
  events: {
    async signIn({ user }) {
      if (!user?.id) return;
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      } catch (err) {
        logger.error("failed to update lastLoginAt", { err: String(err) });
      }
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
      // Self-host guard: a decoded token can carry a user id that does not
      // exist in this app's database — a sibling suite app's cookie minted
      // under the shared NEXTAUTH_SECRET before the per-app cookie prefix, or
      // a cookie that outlived a database wipe. Re-anchor the token by email
      // (the same find-or-create the local sign-in provider performs) so the
      // session always maps to a real local user instead of failing every
      // write with a foreign-key violation.
      if (features.localAuth && token.sub && !user) {
        const known = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { id: true },
        });
        if (!known) {
          const email = token.email?.trim().toLowerCase();
          let localUser = email
            ? await prisma.user.findUnique({ where: { email } })
            : null;
          if (!localUser && email) {
            localUser = await prisma.user
              .create({ data: { email, emailVerified: new Date() } })
              .catch(() => prisma.user.findUnique({ where: { email } }));
          }
          if (localUser) {
            token.sub = localUser.id;
            token.role = localUser.role ?? null;
          } else {
            // No email to re-anchor with — surface as signed out rather than
            // letting an unresolvable id reach the database layer.
            token.sub = undefined;
          }
        }
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
