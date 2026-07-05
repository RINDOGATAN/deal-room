/**
 * Tenant-scoping and entitlement-gating tests for the deal router.
 *
 * Every data-returning procedure on dealRouter must be scoped to the calling
 * user's party membership — a user who is not a party to a deal must get
 * FORBIDDEN (or NOT_FOUND for a nonexistent deal), and unauthenticated calls
 * must get UNAUTHORIZED. deal.create must validate jurisdiction/language
 * against the template and enforce licensing entitlements.
 *
 * Procedures are invoked through `dealRouter.createCaller(ctx)` (the built
 * router's caller — `createCallerFactory` itself is not re-exported from
 * src/server/trpc.ts) with a context built by `createInnerTRPCContext`, whose
 * `prisma` is the module-mocked @/lib/prisma. No real DB is touched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

// --- Module mocks ------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  prisma: {
    contractTemplate: { findUnique: vi.fn(), findFirst: vi.fn() },
    customer: { findFirst: vi.fn() },
    dealRoom: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dealRoomParty: { findFirst: vi.fn(), update: vi.fn() },
    dealRoomClause: { update: vi.fn() },
    invitation: { findMany: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  checkDealCreationEntitlement: vi.fn(),
  autoAgreeSingleOptionClauses: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ decode: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
// Entitlement checks must run (promo off) so the licensing gate is exercised.
vi.mock("@/config/features", () => ({ features: { allSkillsFree: false } }));
vi.mock("@/server/services/licensing/entitlement", () => ({
  checkDealCreationEntitlement: mocks.checkDealCreationEntitlement,
}));
vi.mock("@/server/services/deal/autoAgreeSingleOption", () => ({
  autoAgreeSingleOptionClauses: mocks.autoAgreeSingleOptionClauses,
}));

import { createInnerTRPCContext } from "@/server/trpc";
import { dealRouter } from "@/server/routers/deal";

// --- Helpers -----------------------------------------------------------------

function sessionFor(userId: string, email = `${userId}@example.test`): Session {
  return {
    user: { id: userId, email, name: userId, role: null },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

function callerFor(session: Session | null) {
  const ctx = createInnerTRPCContext({
    session,
    adminSession: null,
    supervisorSession: null,
    getCookie: () => undefined,
  });
  return dealRouter.createCaller(ctx);
}

const alice = sessionFor("user-alice");

/** A free (no skill package) template supporting all jurisdictions/languages. */
const freeTemplate = {
  id: "tpl-nda",
  contractType: "NDA",
  templateFamily: null,
  jurisdictions: ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"],
  languages: ["en", "es"],
  skillPackageId: null,
  skillPackage: null,
  parameterSchema: null,
  clauses: [
    { id: "ct-1", options: [{ id: "opt-1" }, { id: "opt-2" }] },
    { id: "ct-2", options: [{ id: "opt-3" }, { id: "opt-4" }] },
  ],
};

const validCreateInput = {
  name: "Test NDA",
  contractType: "NDA",
  governingLaw: "CALIFORNIA" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.autoAgreeSingleOptionClauses.mockResolvedValue({
    autoAgreed: false,
    singleOptionCount: 0,
  });
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

// --- Authentication gate -------------------------------------------------------

describe("protectedProcedure authentication", () => {
  it("rejects unauthenticated deal.list with UNAUTHORIZED", async () => {
    await expect(callerFor(null).list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects unauthenticated deal.create with UNAUTHORIZED before touching the DB", async () => {
    await expect(callerFor(null).create(validCreateInput)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.prisma.contractTemplate.findUnique).not.toHaveBeenCalled();
  });
});

// --- deal.getById scoping --------------------------------------------------------

describe("deal.getById", () => {
  it("throws NOT_FOUND for a nonexistent deal room", async () => {
    mocks.prisma.dealRoom.findUnique.mockResolvedValue(null);
    await expect(callerFor(alice).getById({ id: "deal-x" })).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
  });

  it("throws FORBIDDEN when the caller is not a party to the deal", async () => {
    mocks.prisma.dealRoom.findUnique.mockResolvedValue({
      id: "deal-1",
      contractLanguage: "en",
      parties: [{ id: "p-bob", userId: "user-bob", role: "INITIATOR" }],
      clauses: [],
    });
    await expect(callerFor(alice).getById({ id: "deal-1" })).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });

  it("returns the deal with the caller's role when the caller is a party", async () => {
    mocks.prisma.dealRoom.findUnique.mockResolvedValue({
      id: "deal-1",
      contractLanguage: "en",
      parties: [
        { id: "p-alice", userId: "user-alice", role: "INITIATOR" },
        { id: "p-bob", userId: "user-bob", role: "RESPONDENT" },
      ],
      clauses: [],
    });
    const result = await callerFor(alice).getById({ id: "deal-1" });
    expect(result.currentUserRole).toBe("INITIATOR");
    expect(result.currentPartyId).toBe("p-alice");
  });
});

// --- deal.list scoping ----------------------------------------------------------

describe("deal.list", () => {
  it("only queries deals where the caller is a party and hides cancelled deals", async () => {
    mocks.prisma.invitation.findMany.mockResolvedValue([]);
    mocks.prisma.dealRoom.findMany.mockResolvedValue([]);

    await callerFor(alice).list();

    expect(mocks.prisma.dealRoom.findMany).toHaveBeenCalledTimes(1);
    const args = mocks.prisma.dealRoom.findMany.mock.calls[0][0];
    expect(args.where.parties.some.userId).toBe("user-alice");
    expect(args.where.status.not).toBe("CANCELLED");
  });
});

// --- deal.create validation -------------------------------------------------------

describe("deal.create", () => {
  it("rejects an unknown governingLaw at the input-schema layer", async () => {
    await expect(
      callerFor(alice).create({
        ...validCreateInput,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        governingLaw: "TEXAS" as any,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.prisma.contractTemplate.findUnique).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND for an unknown contract template", async () => {
    mocks.prisma.contractTemplate.findUnique.mockResolvedValue(null);
    await expect(callerFor(alice).create(validCreateInput)).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
  });

  it("rejects a jurisdiction the template does not support", async () => {
    mocks.prisma.contractTemplate.findUnique.mockResolvedValue({
      ...freeTemplate,
      jurisdictions: ["CALIFORNIA"],
    });
    await expect(
      callerFor(alice).create({ ...validCreateInput, governingLaw: "SPAIN" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("SPAIN"),
    });
    expect(mocks.prisma.dealRoom.create).not.toHaveBeenCalled();
  });

  it("rejects a language the template does not support", async () => {
    mocks.prisma.contractTemplate.findUnique.mockResolvedValue({
      ...freeTemplate,
      languages: ["en"],
    });
    await expect(
      callerFor(alice).create({ ...validCreateInput, contractLanguage: "es" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("es"),
    });
    expect(mocks.prisma.dealRoom.create).not.toHaveBeenCalled();
  });

  it("auto-resolves to the jurisdiction-native template of the same family", async () => {
    // Base template only supports CALIFORNIA, but a Spanish-native sibling
    // exists in the same family — create must switch to it instead of failing.
    mocks.prisma.contractTemplate.findUnique.mockResolvedValue({
      ...freeTemplate,
      templateFamily: "nda-family",
      jurisdictions: ["CALIFORNIA"],
    });
    mocks.prisma.contractTemplate.findFirst.mockResolvedValue({
      ...freeTemplate,
      id: "tpl-nda-es",
      jurisdictions: ["SPAIN"],
    });
    mocks.prisma.dealRoom.create.mockResolvedValue({
      id: "deal-1",
      parties: [],
      clauses: [],
    });

    await callerFor(alice).create({ ...validCreateInput, governingLaw: "SPAIN" });

    expect(mocks.prisma.dealRoom.create).toHaveBeenCalledTimes(1);
    const data = mocks.prisma.dealRoom.create.mock.calls[0][0].data;
    expect(data.contractTemplateId).toBe("tpl-nda-es");
  });

  it("throws FORBIDDEN for a licensed skill when the user has no customer record", async () => {
    mocks.prisma.contractTemplate.findUnique.mockResolvedValue({
      ...freeTemplate,
      skillPackageId: "sp-1",
      skillPackage: { id: "sp-1", skillId: "nda-premium" },
    });
    mocks.prisma.customer.findFirst.mockResolvedValue(null);

    await expect(callerFor(alice).create(validCreateInput)).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
    expect(mocks.checkDealCreationEntitlement).not.toHaveBeenCalled();
    expect(mocks.prisma.dealRoom.create).not.toHaveBeenCalled();
  });

  it("throws FORBIDDEN when the entitlement check fails, passing the mapped jurisdiction", async () => {
    mocks.prisma.contractTemplate.findUnique.mockResolvedValue({
      ...freeTemplate,
      skillPackageId: "sp-1",
      skillPackage: { id: "sp-1", skillId: "nda-premium" },
    });
    mocks.prisma.customer.findFirst.mockResolvedValue({ id: "cust-1" });
    mocks.checkDealCreationEntitlement.mockResolvedValue({
      entitled: false,
      reason: "No entitlement found for this skill",
    });

    await expect(callerFor(alice).create(validCreateInput)).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
    expect(mocks.checkDealCreationEntitlement).toHaveBeenCalledWith(
      "cust-1",
      "NDA",
      "CALIFORNIA",
    );
    expect(mocks.prisma.dealRoom.create).not.toHaveBeenCalled();
  });

  it("rejects creation when required template parameters are missing", async () => {
    mocks.prisma.contractTemplate.findUnique.mockResolvedValue({
      ...freeTemplate,
      parameterSchema: {
        version: "1",
        parameters: [
          {
            id: "purpose",
            token: "purpose",
            scope: "*",
            type: "text",
            required: true,
            label: "Purpose",
          },
        ],
      },
    });

    await expect(callerFor(alice).create(validCreateInput)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("purpose"),
    });
    expect(mocks.prisma.dealRoom.create).not.toHaveBeenCalled();
  });

  it("creates a deal for a free template, seeding the caller as initiator with all clauses", async () => {
    mocks.prisma.contractTemplate.findUnique.mockResolvedValue(freeTemplate);
    mocks.prisma.dealRoom.create.mockResolvedValue({
      id: "deal-1",
      parties: [{ id: "p-alice" }],
      clauses: [
        { id: "dc-1", clauseTemplateId: "ct-1" },
        { id: "dc-2", clauseTemplateId: "ct-2" },
      ],
    });

    const result = await callerFor(alice).create(validCreateInput);

    expect(result.id).toBe("deal-1");
    // Entitlement is never consulted for a free template.
    expect(mocks.checkDealCreationEntitlement).not.toHaveBeenCalled();

    const data = mocks.prisma.dealRoom.create.mock.calls[0][0].data;
    expect(data.parties.create.userId).toBe("user-alice");
    expect(data.parties.create.role).toBe("INITIATOR");
    expect(data.clauses.create).toHaveLength(2);
    expect(data.soloFillRole).toBeNull(); // only DPAs persist a fill role
    expect(data.status).toBe("DRAFT");

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "DEAL_ROOM_CREATED" }),
      }),
    );
  });
});

// --- Mutations: party-membership gates ------------------------------------------

describe("deal mutations require party membership", () => {
  it("updateName throws FORBIDDEN when the caller is not the initiator", async () => {
    mocks.prisma.dealRoomParty.findFirst.mockResolvedValue(null);
    await expect(
      callerFor(alice).updateName({ id: "deal-1", name: "Renamed" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.dealRoom.update).not.toHaveBeenCalled();
  });

  it("updateName succeeds for the initiator", async () => {
    mocks.prisma.dealRoomParty.findFirst.mockResolvedValue({
      id: "p-alice",
      role: "INITIATOR",
    });
    mocks.prisma.dealRoom.update.mockResolvedValue({ id: "deal-1", name: "Renamed" });

    const result = await callerFor(alice).updateName({ id: "deal-1", name: "Renamed" });

    expect(result.name).toBe("Renamed");
    expect(mocks.prisma.dealRoom.update).toHaveBeenCalledWith({
      where: { id: "deal-1" },
      data: { name: "Renamed" },
    });
  });

  it("cancel throws FORBIDDEN when the caller is not a party", async () => {
    mocks.prisma.dealRoomParty.findFirst.mockResolvedValue(null);
    await expect(callerFor(alice).cancel({ id: "deal-1" })).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
    expect(mocks.prisma.dealRoom.update).not.toHaveBeenCalled();
  });

  it("submitSelections throws FORBIDDEN when the caller is not a party", async () => {
    mocks.prisma.dealRoom.findUnique.mockResolvedValue({
      id: "deal-1",
      dealMode: "NEGOTIATION",
      status: "DRAFT",
      parties: [{ id: "p-bob", userId: "user-bob", role: "INITIATOR" }],
      clauses: [],
    });
    await expect(
      callerFor(alice).submitSelections({ dealRoomId: "deal-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
