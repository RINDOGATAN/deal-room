// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Selection privacy on the deal query (cycle 12, F5).
 *
 * A party's option, priority, flexibility and notes are confidential until
 * both parties have submitted. `selections.getForClause` applied that rule;
 * `deal.getById` returned every selection to either party, and
 * `deal.getProgress` answered any signed-in user. Both now follow the rule.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

const mocks = vi.hoisted(() => ({
  prisma: {
    dealRoom: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/config/features", () => ({ features: { allSkillsFree: true } }));
vi.mock("@/server/services/licensing/entitlement", () => ({
  checkDealCreationEntitlement: vi.fn(),
}));
vi.mock("@/server/services/deal/autoAgreeSingleOption", () => ({
  autoAgreeSingleOptionClauses: vi.fn(),
}));

import { createInnerTRPCContext } from "@/server/trpc";
import { dealRouter } from "@/server/routers/deal";

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.test`, name: userId, role: null },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

function callerFor(session: Session | null) {
  return dealRouter.createCaller(
    createInnerTRPCContext({
      session,
      adminSession: null,
      supervisorSession: null,
      getCookie: () => undefined,
    })
  );
}

const alice = sessionFor("user-alice");
const bob = sessionFor("user-bob");
const mallory = sessionFor("user-mallory");

function selection(id: string, partyId: string, notes: string) {
  return {
    id,
    partyId,
    optionId: `opt-${id}`,
    priority: 5,
    flexibility: 1,
    notes,
    option: { id: `opt-${id}`, localizedContent: null },
    party: { id: partyId },
  };
}

/** A fresh two-party deal each time: the procedure filters the object it is given. */
function deal(aliceStatus: string, bobStatus: string) {
  return {
    id: "deal-1",
    contractLanguage: "en",
    parties: [
      { id: "party-alice", userId: "user-alice", role: "INITIATOR", status: aliceStatus },
      { id: "party-bob", userId: "user-bob", role: "RESPONDENT", status: bobStatus },
    ],
    clauses: [
      {
        id: "clause-1",
        status: "PENDING",
        clauseTemplate: { options: [], localizedContent: null },
        selections: [
          selection("s-alice", "party-alice", "we can live with 30 days"),
          selection("s-bob", "party-bob", "walk away below 60 days"),
        ],
        compromiseSuggestions: [],
      },
    ],
    rounds: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deal.getById", () => {
  it("hides the other side's selections while one party is still working", async () => {
    mocks.prisma.dealRoom.findUnique.mockResolvedValue(deal("SUBMITTED", "IN_PROGRESS"));
    const asAlice = await callerFor(alice).getById({ id: "deal-1" });
    expect(asAlice.clauses[0].selections.map((s) => s.partyId)).toEqual(["party-alice"]);

    mocks.prisma.dealRoom.findUnique.mockResolvedValue(deal("SUBMITTED", "IN_PROGRESS"));
    const asBob = await callerFor(bob).getById({ id: "deal-1" });
    expect(asBob.clauses[0].selections.map((s) => s.partyId)).toEqual(["party-bob"]);
    expect(JSON.stringify(asBob)).not.toContain("we can live with 30 days");
  });

  it("shows both once both parties have submitted", async () => {
    mocks.prisma.dealRoom.findUnique.mockResolvedValue(deal("SUBMITTED", "SUBMITTED"));
    const result = await callerFor(alice).getById({ id: "deal-1" });
    expect(result.clauses[0].selections.map((s) => s.partyId)).toEqual([
      "party-alice",
      "party-bob",
    ]);
  });

  it("still refuses a user who is not a party", async () => {
    mocks.prisma.dealRoom.findUnique.mockResolvedValue(deal("SUBMITTED", "SUBMITTED"));
    await expect(callerFor(mallory).getById({ id: "deal-1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("deal.getProgress", () => {
  it("refuses a signed-in user who is not a party", async () => {
    mocks.prisma.dealRoom.findUnique.mockResolvedValue(deal("SUBMITTED", "IN_PROGRESS"));
    await expect(callerFor(mallory).getProgress({ id: "deal-1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("refuses an anonymous caller", async () => {
    await expect(callerFor(null).getProgress({ id: "deal-1" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("still gives a party the counts", async () => {
    mocks.prisma.dealRoom.findUnique.mockResolvedValue(deal("SUBMITTED", "IN_PROGRESS"));
    const progress = await callerFor(bob).getProgress({ id: "deal-1" });
    expect(progress.totalClauses).toBe(1);
    expect(progress.initiatorProgress.completed).toBe(1);
    expect(progress.respondentProgress.completed).toBe(1);
  });
});
