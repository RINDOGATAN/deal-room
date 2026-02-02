import { PrismaClient } from "@prisma/client";
import type { Adapter, AdapterUser } from "next-auth/adapters";

/**
 * Minimal adapter for Supervisor authentication.
 * Only implements verification token methods required for email provider.
 * Does not use the standard User table - supervisors are stored in Supervisor table.
 */
export function createSupervisorAdapter(prisma: PrismaClient): Adapter {
  return {
    // Create a virtual user for the supervisor - we don't actually use the User table
    async createUser(user) {
      // Return a virtual user based on Supervisor
      const supervisor = await prisma.supervisor.findUnique({
        where: { email: user.email!.toLowerCase() },
      });

      if (!supervisor) {
        throw new Error("Not authorized as supervisor");
      }

      return {
        id: supervisor.id,
        email: supervisor.email,
        name: supervisor.name,
        emailVerified: new Date(),
      } as AdapterUser;
    },

    async getUser(id) {
      const supervisor = await prisma.supervisor.findUnique({
        where: { id },
      });

      if (!supervisor) return null;

      return {
        id: supervisor.id,
        email: supervisor.email,
        name: supervisor.name,
        emailVerified: new Date(),
      } as AdapterUser;
    },

    async getUserByEmail(email) {
      const supervisor = await prisma.supervisor.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!supervisor) return null;

      return {
        id: supervisor.id,
        email: supervisor.email,
        name: supervisor.name,
        emailVerified: new Date(),
      } as AdapterUser;
    },

    async getUserByAccount() {
      // Not used for email provider
      return null;
    },

    async updateUser(user) {
      // We don't update supervisors through NextAuth
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
    async createVerificationToken(data) {
      const token = await prisma.verificationToken.create({
        data: {
          identifier: data.identifier,
          token: data.token,
          expires: data.expires,
        },
      });
      return token;
    },

    async useVerificationToken({ identifier, token }) {
      try {
        const verificationToken = await prisma.verificationToken.delete({
          where: {
            identifier_token: {
              identifier,
              token,
            },
          },
        });
        return verificationToken;
      } catch {
        // Token not found or already used
        return null;
      }
    },
  };
}
