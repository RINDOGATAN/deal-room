import { PrismaClient } from "@prisma/client";
import type { Adapter, AdapterUser, VerificationToken } from "next-auth/adapters";

/**
 * Minimal adapter for Platform Admin authentication.
 * Only implements verification token methods required for email provider.
 * Does not use the standard User table - admins are stored in PlatformAdmin.
 */
export function createAdminAdapter(prisma: PrismaClient): Adapter {
  return {
    // Create a virtual user for the admin - we don't actually use the User table
    async createUser(user: Omit<AdapterUser, "id">) {
      // Return a virtual user based on PlatformAdmin
      const admin = await prisma.platformAdmin.findUnique({
        where: { email: user.email!.toLowerCase() },
      });

      if (!admin) {
        throw new Error("Not authorized as platform administrator");
      }

      return {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        emailVerified: new Date(),
      } as AdapterUser;
    },

    async getUser(id: string) {
      const admin = await prisma.platformAdmin.findUnique({
        where: { id },
      });

      if (!admin) return null;

      return {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        emailVerified: new Date(),
      } as AdapterUser;
    },

    async getUserByEmail(email: string) {
      const admin = await prisma.platformAdmin.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!admin) return null;

      return {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        emailVerified: new Date(),
      } as AdapterUser;
    },

    async getUserByAccount() {
      // Not used for email provider
      return null;
    },

    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">) {
      // We don't update admins through NextAuth
      return user as AdapterUser;
    },

    async deleteUser() {
      // Not implemented
    },

    async linkAccount() {
      // Not used for email provider
      return undefined;
    },

    async unlinkAccount() {
      // Not used for email provider
    },

    async createSession() {
      // We use JWT sessions, not database sessions
      throw new Error("Database sessions not supported");
    },

    async getSessionAndUser() {
      // We use JWT sessions
      return null;
    },

    async updateSession() {
      // We use JWT sessions
      return null;
    },

    async deleteSession() {
      // We use JWT sessions
    },

    // These are the critical methods for email provider
    async createVerificationToken(data: VerificationToken) {
      console.log("[Admin Adapter] Creating verification token:", {
        identifier: data.identifier,
        tokenPrefix: data.token.substring(0, 10) + "...",
        expires: data.expires,
      });
      const token = await prisma.verificationToken.create({
        data: {
          identifier: data.identifier,
          token: data.token,
          expires: data.expires,
        },
      });
      console.log("[Admin Adapter] Token created successfully");
      return token;
    },

    async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
      console.log("[Admin Adapter] Looking up verification token:", {
        identifier,
        tokenPrefix: token.substring(0, 10) + "...",
      });
      try {
        const verificationToken = await prisma.verificationToken.delete({
          where: {
            identifier_token: {
              identifier,
              token,
            },
          },
        });
        console.log("[Admin Adapter] Token found and deleted successfully");
        return verificationToken;
      } catch (error) {
        console.error("[Admin Adapter] Token lookup failed:", error);
        // Token not found or already used
        return null;
      }
    },
  };
}
