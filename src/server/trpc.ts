// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { getServerSession, type Session } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import {
  readAdminSession,
  readSupervisorSession,
  type AdminPortalSession,
  type SupervisorPortalSession,
} from "@/lib/portal-session";
import prisma from "@/lib/prisma";
import { presentInternalError } from "@/server/internal-error";
import { features } from "@/config/features";
import { pilotMutationExempt } from "@/lib/pilot";
import { PilotCapError, assertPilotCanEdit } from "@/server/services/pilot";

interface CreateContextOptions {
  session: Session | null;
  adminSession: AdminPortalSession | null;
  supervisorSession: SupervisorPortalSession | null;
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

export const createTRPCContext = async (_opts: { req: Request }) => {
  const session = await getServerSession(authOptions);
  const cookieStore = await cookies();

  // Portal sessions: only a token issued by that portal's own sign-in reads
  // as a session (own key, own identity claim). Anything else is null.
  const adminSession = await readAdminSession(cookieStore.get("admin_session")?.value);
  const supervisorSession = await readSupervisorSession(
    cookieStore.get("supervisor_session")?.value
  );

  return createInnerTRPCContext({
    session,
    adminSession,
    supervisorSession,
    getCookie: (name: string) => cookieStore.get(name)?.value,
  });
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error, path }) {
    // A failure on our side: logged under a reference id, and the person
    // reads what to do next instead of "Internal server error".
    const internal =
      error.code === "INTERNAL_SERVER_ERROR" ? presentInternalError(error, path) : null;
    return {
      ...shape,
      message: internal ? internal.message : shape.message,
      data: {
        ...shape.data,
        // Never send a server stack trace to the browser.
        stack: undefined,
        reference: internal?.reference ?? null,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
        // Hosted pilot cap reached: the interface shows its own translation.
        pilotCap:
          error.cause instanceof PilotCapError ? error.cause.reason : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  // The id check is redundant in the types but real at runtime: the jwt
  // callback clears token.sub when a stale token cannot be re-anchored to a
  // local user, and a session without a user id must read as signed out —
  // never reach Prisma as userId: undefined.
  if (!ctx.session || !ctx.session.user || !ctx.session.user.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

// Hosted pilot: after the 90-day edit window the account is read-only.
// Queries always pass; mutations are refused except the few in
// `pilotAllowsMutation`. The export is a plain GET route and never passes
// through here. No-op on the kit.
const enforcePilotEditWindow = t.middleware(async ({ ctx, next, type, path }) => {
  const userId = ctx.session?.user?.id;
  if (features.hostedPilot && type === "mutation" && userId && !pilotMutationExempt(path)) {
    await assertPilotCanEdit(ctx.prisma, userId);
  }
  return next();
});

export const protectedProcedure = t.procedure
  .use(enforceUserIsAuthed)
  .use(enforcePilotEditWindow);

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

// Lawyer procedure - requires authenticated user with isLawyer flag
const enforceUserIsLawyer = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { isLawyer: true },
  });
  if (!user?.isLawyer) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Lawyer access required" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const lawyerProcedure = t.procedure
  .use(enforceUserIsLawyer)
  .use(enforcePilotEditWindow);
