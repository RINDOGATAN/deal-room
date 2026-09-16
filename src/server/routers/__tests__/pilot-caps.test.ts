// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Hosted pilot caps through the real routers: the organisation limit, the
 * deal and journey ceilings, and the switch to read-only after 90 days.
 * Same harness as deal.test.ts (module-mocked prisma, createCaller), with
 * the features mock set to the hosted pilot.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
    contractTemplate: { findUnique: vi.fn(), findFirst: vi.fn() },
    customer: { findFirst: vi.fn() },
    dealRoom: {
      count: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dealRoomParty: { findFirst: vi.fn(), update: vi.fn() },
    startupJourney: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    invitation: { findMany: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
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
vi.mock("@/config/features", () => ({
  features: { hostedPilot: true, allSkillsFree: true, localAuth: false },
}));
vi.mock("@/server/services/licensing/entitlement", () => ({
  checkDealCreationEntitlement: mocks.checkDealCreationEntitlement,
}));
vi.mock("@/server/services/deal/autoAgreeSingleOption", () => ({
  autoAgreeSingleOptionClauses: mocks.autoAgreeSingleOptionClauses,
}));

import { createInnerTRPCContext } from "@/server/trpc";
import { dealRouter } from "@/server/routers/deal";
import { journeyRouter } from "@/server/routers/journey";
import { pilotRouter } from "@/server/routers/pilot";
import { PilotCapError } from "@/server/services/pilot";
import { PILOT_CAPS } from "@/lib/pilot";

const DAY = 24 * 60 * 60 * 1000;

const alice: Session = {
  user: { id: "user-alice", email: "alice@example.test", name: "Alice", role: null },
  expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};

function ctx() {
  return createInnerTRPCContext({
    session: alice,
    adminSession: null,
    supervisorSession: null,
    getCookie: () => undefined,
  });
}

const deals = () => dealRouter.createCaller(ctx());
const journeys = () => journeyRouter.createCaller(ctx());
const pilot = () => pilotRouter.createCaller(ctx());

const freeTemplate = {
  id: "tpl-nda",
  contractType: "NDA",
  templateFamily: null,
  jurisdictions: ["CALIFORNIA"],
  languages: ["en"],
  skillPackageId: null,
  skillPackage: null,
  parameterSchema: null,
  presets: null,
  clauses: [],
};

const createInput = { name: "Pilot NDA", contractType: "NDA", governingLaw: "CALIFORNIA" as const };

/** The account's pilot started `daysAgo` days ago. */
function pilotStarted(daysAgo: number) {
  mocks.prisma.user.findUnique.mockResolvedValue({
    pilotStartedAt: new Date(Date.now() - daysAgo * DAY),
  });
}

async function expectPilotCap(promise: Promise<unknown>, reason: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e as { code?: string; cause?: unknown },
  );
  expect(error).not.toBeNull();
  expect(error?.code).toBe("FORBIDDEN");
  expect(error?.cause).toBeInstanceOf(PilotCapError);
  expect((error?.cause as PilotCapError).reason).toBe(reason);
}

beforeEach(() => {
  vi.clearAllMocks();
  pilotStarted(1);
  mocks.prisma.user.updateMany.mockResolvedValue({ count: 0 });
  mocks.prisma.dealRoom.count.mockResolvedValue(0);
  mocks.prisma.startupJourney.count.mockResolvedValue(0);
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.autoAgreeSingleOptionClauses.mockResolvedValue({ autoAgreed: false, singleOptionCount: 0 });
  mocks.prisma.contractTemplate.findUnique.mockResolvedValue(freeTemplate);
  mocks.prisma.dealRoom.create.mockResolvedValue({ id: "deal-new", parties: [], clauses: [] });
});

describe("organisation limit", () => {
  it("reports exactly one organisation per account", async () => {
    const status = await pilot().status();
    expect(status.hosted).toBe(true);
    expect(status.organisations).toEqual({ used: 1, limit: PILOT_CAPS.organisationsPerAccount });
    expect(PILOT_CAPS.organisationsPerAccount).toBe(1);
  });

  it("counts only deals this account started, never other accounts' deals", async () => {
    mocks.prisma.dealRoom.count.mockResolvedValue(4);
    const status = await pilot().status();
    expect(status.deals).toEqual({ used: 4, limit: PILOT_CAPS.deals });
    expect(mocks.prisma.dealRoom.count).toHaveBeenCalledWith({
      where: { parties: { some: { userId: "user-alice", role: "INITIATOR" } } },
    });
  });
});

describe("records ceiling", () => {
  it("creates a deal below the ceiling", async () => {
    mocks.prisma.dealRoom.count.mockResolvedValue(PILOT_CAPS.deals - 1);
    await expect(deals().create(createInput)).resolves.toMatchObject({ id: "deal-new" });
    expect(mocks.prisma.dealRoom.create).toHaveBeenCalledTimes(1);
  });

  it("refuses the deal that would pass the ceiling, before any write", async () => {
    mocks.prisma.dealRoom.count.mockResolvedValue(PILOT_CAPS.deals);
    await expectPilotCap(deals().create(createInput), "deals");
    expect(mocks.prisma.contractTemplate.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.dealRoom.create).not.toHaveBeenCalled();
  });

  it("names both ways out in the refusal", async () => {
    mocks.prisma.dealRoom.count.mockResolvedValue(PILOT_CAPS.deals);
    await expect(deals().create(createInput)).rejects.toMatchObject({
      message: expect.stringMatching(/todo\.law\/run[\s\S]*\/api\/account\/export/),
    });
  });

  it("refuses a startup journey past the journey ceiling", async () => {
    mocks.prisma.startupJourney.count.mockResolvedValue(PILOT_CAPS.journeys);
    await expectPilotCap(
      journeys().create({
        companyName: "Acme",
        founders: [{ name: "Founder", email: "founder@example.test", isIncorporator: true, isPrimary: true }],
      }),
      "journeys",
    );
    expect(mocks.prisma.startupJourney.create).not.toHaveBeenCalled();
  });
});

describe("90-day switch to read-only", () => {
  it("allows edits on day 89", async () => {
    pilotStarted(89);
    mocks.prisma.dealRoomParty.findFirst.mockResolvedValue({ id: "p-alice", role: "INITIATOR" });
    mocks.prisma.dealRoom.update.mockResolvedValue({ id: "deal-1", name: "Renamed" });
    await expect(deals().updateName({ id: "deal-1", name: "Renamed" })).resolves.toMatchObject({
      name: "Renamed",
    });
  });

  it("refuses every edit after day 90, before the procedure runs", async () => {
    pilotStarted(91);
    await expectPilotCap(deals().updateName({ id: "deal-1", name: "Renamed" }), "read_only");
    await expectPilotCap(deals().create(createInput), "read_only");
    expect(mocks.prisma.dealRoomParty.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.dealRoom.update).not.toHaveBeenCalled();
    expect(mocks.prisma.dealRoom.create).not.toHaveBeenCalled();
  });

  it("keeps reads open after day 90", async () => {
    pilotStarted(91);
    mocks.prisma.invitation.findMany.mockResolvedValue([]);
    mocks.prisma.dealRoom.findMany.mockResolvedValue([]);
    await expect(deals().list()).resolves.toBeDefined();
  });

  it("reports the counter as ended after day 90", async () => {
    pilotStarted(91);
    const status = await pilot().status();
    expect(status).toMatchObject({ readOnly: true, daysLeft: 0 });
  });

  it("starts the clock on first use for an account that predates the pilot", async () => {
    mocks.prisma.user.findUnique
      .mockResolvedValueOnce({ pilotStartedAt: null })
      .mockResolvedValueOnce({ pilotStartedAt: new Date() });
    const status = await pilot().status();
    expect(mocks.prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-alice", pilotStartedAt: null },
      data: { pilotStartedAt: expect.any(Date) },
    });
    expect(status).toMatchObject({ readOnly: false, daysLeft: 90 });
  });
});
