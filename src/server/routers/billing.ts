import { createTRPCRouter, protectedProcedure } from "../trpc";
import { features } from "@/config/features";

export const billingRouter = createTRPCRouter({
  getConfig: protectedProcedure.query(() => {
    return {
      stripeEnabled: features.stripeEnabled,
      selfServiceUpgrade: features.selfServiceUpgrade,
    };
  }),

  getSubscriptionStatus: protectedProcedure.query(async ({ ctx }) => {
    const email = ctx.session.user.email;
    if (!email) return { entitlements: [], stripeCustomerId: null };

    const customer = await ctx.prisma.customer.findUnique({
      where: { email },
      include: {
        entitlements: {
          include: {
            skillPackage: {
              select: {
                skillId: true,
                displayName: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!customer) return { entitlements: [], stripeCustomerId: null };

    return {
      stripeCustomerId: customer.stripeCustomerId,
      entitlements: customer.entitlements.map((e) => ({
        id: e.id,
        skillId: e.skillPackage.skillId,
        name: e.skillPackage.displayName,
        status: e.status,
        licenseType: e.licenseType,
        expiresAt: e.expiresAt?.toISOString() ?? null,
        stripeSubscriptionId: e.stripeSubscriptionId,
      })),
    };
  }),

  hasVettedContracts: protectedProcedure.query(async ({ ctx }) => {
    const email = ctx.session.user.email;
    if (!email) return { active: false, selfServiceUpgrade: features.selfServiceUpgrade, skillPackageId: null };

    const vettedPkg = await ctx.prisma.skillPackage.findUnique({
      where: { skillId: "com.nel.features.vetted-contracts" },
      select: { id: true },
    });

    if (!vettedPkg) return { active: false, selfServiceUpgrade: features.selfServiceUpgrade, skillPackageId: null };

    const customer = await ctx.prisma.customer.findUnique({
      where: { email },
      include: {
        entitlements: {
          where: { skillPackageId: vettedPkg.id, status: "ACTIVE" },
          take: 1,
        },
      },
    });

    return {
      active: (customer?.entitlements.length ?? 0) > 0,
      selfServiceUpgrade: features.selfServiceUpgrade,
      skillPackageId: vettedPkg.id,
    };
  }),

  getAvailablePlans: protectedProcedure.query(async ({ ctx }) => {
    const email = ctx.session.user.email;

    const packages = await ctx.prisma.skillPackage.findMany({
      where: { isPremium: true, isActive: true },
      orderBy: { displayName: "asc" },
    });

    // Check which ones the user already has entitlements for
    let entitledSkillPackageIds: Set<string> = new Set();
    if (email) {
      const customer = await ctx.prisma.customer.findUnique({
        where: { email },
        include: {
          entitlements: {
            where: { status: "ACTIVE" },
            select: { skillPackageId: true },
          },
        },
      });
      if (customer) {
        entitledSkillPackageIds = new Set(
          customer.entitlements.map((e) => e.skillPackageId)
        );
      }
    }

    return packages.map((pkg) => ({
      id: pkg.id,
      skillId: pkg.skillId,
      name: pkg.displayName,
      description: pkg.description,
      priceAmount: pkg.priceAmount,
      priceCurrency: pkg.priceCurrency,
      isEntitled: entitledSkillPackageIds.has(pkg.id),
    }));
  }),
});
