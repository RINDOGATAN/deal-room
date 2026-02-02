import { initTRPC, TRPCError } from "@trpc/server";
import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import superjson from "superjson";
import { ZodError } from "zod";
import { getServerSession, type Session } from "next-auth";
import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface CreateContextOptions {
  session: Session | null;
  adminSession: { email: string; adminId: string } | null;
  supervisorSession: { email: string; supervisorId: string } | null;
  getCookie: (name: string) => string | undefined;
}

export const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    adminSession: opts.adminSession,
    supervisorSession: opts.supervisorSession,
    prisma,
    getCookie: opts.getCookie,
  };
};

export const createTRPCContext = async (opts: { req: Request }) => {
  const session = await getServerSession(authOptions);
  const cookieStore = await cookies();

  // Try to decode admin session from JWT
  let adminSession: { email: string; adminId: string } | null = null;
  const adminToken = cookieStore.get("admin_session")?.value;
  if (adminToken) {
    try {
      const decoded = await decode({
        token: adminToken,
        secret: process.env.NEXTAUTH_SECRET!,
      });

      // If we have adminId and email directly, use them
      if (decoded?.email && decoded?.adminId) {
        adminSession = {
          email: decoded.email as string,
          adminId: decoded.adminId as string,
        };
      }
      // Fallback: if we only have sub (user ID), look up the admin
      else if (decoded?.sub) {
        const admin = await prisma.platformAdmin.findUnique({
          where: { id: decoded.sub },
        });
        if (admin) {
          adminSession = {
            email: admin.email,
            adminId: admin.id,
          };
        }
      }
    } catch {
      // Invalid token, ignore
    }
  }

  // Try to decode supervisor session from JWT
  let supervisorSession: { email: string; supervisorId: string } | null = null;
  const supervisorToken = cookieStore.get("supervisor_session")?.value;
  if (supervisorToken) {
    try {
      const decoded = await decode({
        token: supervisorToken,
        secret: process.env.NEXTAUTH_SECRET!,
      });
      if (decoded?.email && decoded?.supervisorId) {
        supervisorSession = {
          email: decoded.email as string,
          supervisorId: decoded.supervisorId as string,
        };
      }
    } catch {
      // Invalid token, ignore
    }
  }

  return createInnerTRPCContext({
    session,
    adminSession,
    supervisorSession,
    getCookie: (name: string) => cookieStore.get(name)?.value,
  });
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

// Admin procedure - requires admin session
const enforceAdminIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.adminSession) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin session required" });
  }
  return next({
    ctx: {
      adminSession: ctx.adminSession,
    },
  });
});

export const adminProcedure = t.procedure.use(enforceAdminIsAuthed);

// Supervisor procedure - requires supervisor session
const enforceSupervisorIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.supervisorSession) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Supervisor session required" });
  }
  return next({
    ctx: {
      supervisorSession: ctx.supervisorSession,
    },
  });
});

export const supervisorProcedure = t.procedure.use(enforceSupervisorIsAuthed);
