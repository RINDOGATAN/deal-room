// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Hosted pilot: a capped or expired account can still read and export
 * everything it created.
 *
 * One suite for the promise the pilot makes to a firm, in three states:
 *   - AT CAP: every deal and journey allowance used, window still open;
 *   - EXPIRED: the 90-day window has closed (read-only);
 *   - BOTH: at every cap and past the window.
 * In each state the account reads its deals and journeys, its pilot
 * counters, and exports the lot. What is refused (new records, edits) is
 * covered in `server/routers/__tests__/pilot-caps.test.ts`; this suite
 * proves the refusals never reach reading or exporting.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Session } from "next-auth";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
    dealRoom: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    dealRoomParty: { update: vi.fn() },
    startupJourney: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    invitation: { findMany: vi.fn(), update: vi.fn() },
    clauseOption: { findMany: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("next-auth/jwt", () => ({ decode: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/config/features", () => ({
  features: { hostedPilot: true, allSkillsFree: true, localAuth: false },
}));

import { createInnerTRPCContext, createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { dealRouter } from "@/server/routers/deal";
import { journeyRouter } from "@/server/routers/journey";
import { pilotRouter } from "@/server/routers/pilot";
import { PilotCapError } from "@/server/services/pilot";
import { GET as exportAccount } from "@/app/api/account/export/route";
import { PILOT_CAPS, pilotEditWindow } from "@/lib/pilot";

const DAY = 24 * 60 * 60 * 1000;
const TODAY = new Date("2027-03-01T12:00:00Z");

const alice: Session = {
  user: { id: "user-alice", email: "alice@example.test", name: "Alice", role: null },
  expires: new Date(TODAY.getTime() + 60 * 60 * 1000).toISOString(),
};

function ctx() {
  return createInnerTRPCContext({
    session: alice,
    adminSession: null,
    supervisorSession: null,
    getCookie: () => undefined,
  });
}

const deal = {
  id: "deal-1",
  name: "Pilot NDA",
  dealMode: "SOLO",
  status: "COMPLETED",
  governingLaw: "CALIFORNIA",
  contractLanguage: "en",
  parameters: {},
  createdAt: new Date("2026-10-02T00:00:00Z"),
  updatedAt: new Date("2026-10-03T00:00:00Z"),
  contractTemplate: { contractType: "NDA", displayName: "NDA" },
  lawyerVetting: null,
  rounds: [],
  parties: [
    {
      id: "p-a",
      userId: "user-alice",
      role: "INITIATOR",
      status: "ACCEPTED",
      email: "alice@example.test",
      name: "Alice",
      company: null,
      signingDetails: null,
      user: { id: "user-alice", name: "Alice", email: "alice@example.test", company: null },
    },
  ],
  clauses: [],
};

const journey = { id: "j-1", userId: "user-alice", companyName: "Acme", founders: [], dealRooms: [], _count: { dealRooms: 0 } };

type State = "at cap" | "expired" | "at cap and expired";
const STATES: State[] = ["at cap", "expired", "at cap and expired"];

function enter(state: State) {
  const atCap = state !== "expired";
  const daysIn = state === "at cap" ? 10 : 120;
  mocks.prisma.user.findUnique.mockResolvedValue({
    pilotStartedAt: new Date(TODAY.getTime() - daysIn * DAY),
    email: "alice@example.test",
    name: "Alice",
    company: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
  });
  mocks.prisma.dealRoom.count.mockResolvedValue(atCap ? PILOT_CAPS.deals : 1);
  mocks.prisma.startupJourney.count.mockResolvedValue(atCap ? PILOT_CAPS.journeys : 1);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  mocks.getServerSession.mockResolvedValue(alice);
  mocks.prisma.user.updateMany.mockResolvedValue({ count: 0 });
  mocks.prisma.invitation.findMany.mockResolvedValue([]);
  mocks.prisma.dealRoom.findMany.mockResolvedValue([deal]);
  mocks.prisma.dealRoom.findUnique.mockResolvedValue(structuredClone(deal));
  mocks.prisma.startupJourney.findMany.mockResolvedValue([journey]);
  mocks.prisma.startupJourney.findFirst.mockResolvedValue(journey);
  mocks.prisma.clauseOption.findMany.mockResolvedValue([]);
});

afterEach(() => vi.useRealTimers());

describe.each(STATES)("pilot account %s", (state) => {
  beforeEach(() => enter(state));

  it("still lists and opens its deals", async () => {
    const deals = dealRouter.createCaller(ctx());
    await expect(deals.list()).resolves.toBeDefined();
    await expect(deals.getById({ id: "deal-1" })).resolves.toMatchObject({ id: "deal-1" });
  });

  it("still lists and opens its startup journeys", async () => {
    const journeys = journeyRouter.createCaller(ctx());
    await expect(journeys.list()).resolves.toHaveLength(1);
    await expect(journeys.get({ id: "j-1" })).resolves.toMatchObject({ id: "j-1" });
  });

  it("still sees its counters", async () => {
    const status = await pilotRouter.createCaller(ctx()).status();
    expect(status.hosted).toBe(true);
    expect(status.readOnly).toBe(state !== "at cap");
  });

  it("still exports everything it created", async () => {
    const res = await exportAccount();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(JSON.stringify(body)).toContain("deal-1");
    expect(JSON.stringify(body)).toContain("Acme");
  });
});

describe("the edit-window check reaches mutations only", () => {
  const probe = createTRPCRouter({
    read: protectedProcedure.query(() => "read"),
    write: protectedProcedure.mutation(() => "written"),
  });

  it("an expired account reads through any protected query but cannot write", async () => {
    enter("expired");
    const caller = probe.createCaller(ctx());
    await expect(caller.read()).resolves.toBe("read");
    const refused = await caller.write().catch((e: { cause?: unknown }) => e.cause);
    expect(refused).toBeInstanceOf(PilotCapError);
  });

  it("the clock never marks reading as closed: after the window it only turns read-only", () => {
    const w = pilotEditWindow(new Date(TODAY.getTime() - 1000 * DAY), TODAY);
    expect(w).toMatchObject({ readOnly: true, daysLeft: 0 });
    expect(Object.keys(w).sort()).toEqual(["daysLeft", "endsAt", "readOnly", "startedAt"]);
  });
});

describe("export routes never consult the pilot", () => {
  const root = join(__dirname, "..", "..", "app", "api");
  const routes = [
    "account/export/route.ts",
    "deals/[id]/document/route.ts",
    "deals/[id]/document/docx/route.ts",
    "deals/[id]/document/txt/route.ts",
    "deals/[id]/tia/route.ts",
  ];

  it.each(routes)("%s has no pilot check", (file) => {
    const src = readFileSync(join(root, file), "utf8");
    expect(src).not.toMatch(/assertPilot|isPilotReadOnly|pilotCap|services\/pilot/);
    expect(src).toMatch(/export async function GET/);
  });
});
