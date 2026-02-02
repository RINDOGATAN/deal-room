import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

// Helper to require supervisor access
const requireSupervisor = async (
  email: string | null | undefined,
  getCookie: (name: string) => string | undefined,
  prisma: any
) => {
  if (!email) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }

  const supervisor = await prisma.supervisor.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!supervisor || !supervisor.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Supervisor access required",
    });
  }

  const twoFactorVerified = getCookie("supervisor_2fa_verified");
  if (twoFactorVerified !== "true") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "2FA verification required",
    });
  }

  return supervisor;
};

export const supervisorRouter = createTRPCRouter({
  // Get deals assigned to the current supervisor
  getAssignedDeals: protectedProcedure.query(async ({ ctx }) => {
    const supervisor = await requireSupervisor(
      ctx.session.user.email,
      ctx.getCookie,
      ctx.prisma
    );

    const assignments = await ctx.prisma.supervisorAssignment.findMany({
      where: { supervisorId: supervisor.id },
      include: {
        dealRoom: {
          include: {
            contractTemplate: true,
            parties: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    company: true,
                  },
                },
              },
            },
            clauses: {
              include: {
                clauseTemplate: true,
                selections: {
                  include: {
                    option: true,
                    party: true,
                  },
                },
                compromiseSuggestions: {
                  orderBy: { roundNumber: "desc" },
                  take: 1,
                },
              },
              orderBy: {
                clauseTemplate: {
                  order: "asc",
                },
              },
            },
            _count: {
              select: {
                clauses: true,
              },
            },
          },
        },
      },
      orderBy: {
        dealRoom: {
          updatedAt: "desc",
        },
      },
    });

    return assignments.map((a) => a.dealRoom);
  }),

  // Get detailed deal info (only if assigned to supervisor)
  getDealDetails: protectedProcedure
    .input(z.object({ dealId: z.string() }))
    .query(async ({ ctx, input }) => {
      const supervisor = await requireSupervisor(
        ctx.session.user.email,
        ctx.getCookie,
        ctx.prisma
      );

      // Check assignment
      const assignment = await ctx.prisma.supervisorAssignment.findUnique({
        where: {
          supervisorId_dealRoomId: {
            supervisorId: supervisor.id,
            dealRoomId: input.dealId,
          },
        },
      });

      if (!assignment) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not assigned to this deal",
        });
      }

      const deal = await ctx.prisma.dealRoom.findUnique({
        where: { id: input.dealId },
        include: {
          contractTemplate: true,
          parties: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  company: true,
                },
              },
              selections: {
                include: {
                  option: true,
                  dealRoomClause: {
                    include: {
                      clauseTemplate: true,
                    },
                  },
                },
              },
            },
          },
          clauses: {
            include: {
              clauseTemplate: {
                include: {
                  options: {
                    orderBy: { order: "asc" },
                  },
                },
              },
              selections: {
                include: {
                  option: true,
                  party: true,
                },
              },
              compromiseSuggestions: {
                orderBy: { roundNumber: "desc" },
                include: {
                  suggestedOption: true,
                },
              },
            },
            orderBy: {
              clauseTemplate: {
                order: "asc",
              },
            },
          },
          rounds: {
            include: {
              counterProposals: {
                include: {
                  party: true,
                  proposedOption: true,
                },
              },
            },
            orderBy: {
              roundNumber: "desc",
            },
          },
          auditLogs: {
            orderBy: {
              createdAt: "desc",
            },
            take: 50,
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          signingRequest: true,
        },
      });

      if (!deal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal not found",
        });
      }

      return deal;
    }),

  // Get audit log for a deal (only if assigned)
  getAuditLog: protectedProcedure
    .input(z.object({ dealId: z.string() }))
    .query(async ({ ctx, input }) => {
      const supervisor = await requireSupervisor(
        ctx.session.user.email,
        ctx.getCookie,
        ctx.prisma
      );

      // Check assignment
      const assignment = await ctx.prisma.supervisorAssignment.findUnique({
        where: {
          supervisorId_dealRoomId: {
            supervisorId: supervisor.id,
            dealRoomId: input.dealId,
          },
        },
      });

      if (!assignment) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not assigned to this deal",
        });
      }

      return ctx.prisma.auditLog.findMany({
        where: { dealRoomId: input.dealId },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });
    }),
});
