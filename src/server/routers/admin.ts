import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { isAdminEmail } from "@/lib/totp";

const requireAdmin = (
  email: string | null | undefined,
  getCookie: (name: string) => string | undefined
) => {
  if (!isAdminEmail(email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  const twoFactorVerified = getCookie("admin_2fa_verified");
  if (twoFactorVerified !== "true") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "2FA verification required",
    });
  }
};

export const adminRouter = createTRPCRouter({
  // Get all deals (admin only)
  getAllDeals: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.session.user.email, ctx.getCookie);

    const deals = await ctx.prisma.dealRoom.findMany({
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
      orderBy: {
        updatedAt: "desc",
      },
    });

    return deals;
  }),

  // Get detailed deal info (admin only)
  getDealDetails: protectedProcedure
    .input(z.object({ dealId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.session.user.email, ctx.getCookie);

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

  // Get negotiation analytics
  getAnalytics: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.session.user.email, ctx.getCookie);

    const [
      totalDeals,
      dealsByStatus,
      avgClausesPerDeal,
      recentActivity,
    ] = await Promise.all([
      ctx.prisma.dealRoom.count(),
      ctx.prisma.dealRoom.groupBy({
        by: ["status"],
        _count: true,
      }),
      ctx.prisma.dealRoom.aggregate({
        _avg: {
          currentRound: true,
        },
      }),
      ctx.prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          dealRoom: {
            select: { name: true },
          },
          user: {
            select: { name: true, email: true },
          },
        },
      }),
    ]);

    return {
      totalDeals,
      dealsByStatus: dealsByStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count;
          return acc;
        },
        {} as Record<string, number>
      ),
      avgRounds: avgClausesPerDeal._avg.currentRound || 0,
      recentActivity,
    };
  }),
});
