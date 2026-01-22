import { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    // Dev-only credentials provider for testing
    CredentialsProvider({
      id: "dev-login",
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (process.env.NODE_ENV === "production") {
          return null;
        }

        const email = credentials?.email || "test@example.com";

        // Define test user profiles
        const testUsers: Record<string, { name: string; company: string; role: string }> = {
          "alice@company-a.com": { name: "Alice Johnson", company: "Company A Inc.", role: "user" },
          "bob@company-b.com": { name: "Bob Smith", company: "Company B Ltd.", role: "user" },
          "admin@lawfirm.com": { name: "Sarah Chen", company: "Chen & Associates LLP", role: "admin" },
        };

        const profile = testUsers[email] || { name: "Test User", company: "Test Co", role: "user" };

        // Find or create the test user
        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name: profile.name,
              company: profile.company,
            },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: profile.role,
        };
      },
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  session: {
    strategy: "jwt",
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
