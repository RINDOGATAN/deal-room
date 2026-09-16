// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GET /api/account/export — one of the two ways out of the hosted pilot.
 * It must work for a read-only account (it never consults the pilot
 * window), return everything the account created, and keep the other
 * party's private selections out.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
    dealRoom: { findMany: vi.fn() },
    startupJourney: { findMany: vi.fn() },
    clauseOption: { findMany: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/config/features", () => ({ features: { hostedPilot: true } }));

import { GET } from "@/app/api/account/export/route";

beforeEach(() => {
  vi.clearAllMocks();
  // An account whose 90-day window closed long ago.
  mocks.prisma.user.findUnique.mockResolvedValue({
    email: "alice@example.test",
    name: "Alice",
    company: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    pilotStartedAt: new Date("2026-01-01T00:00:00Z"),
  });
  mocks.prisma.startupJourney.findMany.mockResolvedValue([]);
  mocks.prisma.clauseOption.findMany.mockResolvedValue([
    { id: "opt-2", optionId: "o-2", code: "two", label: "Two", legalText: "Agreed text." },
  ]);
  mocks.prisma.dealRoom.findMany.mockResolvedValue([
    {
      id: "deal-1",
      name: "NDA",
      dealMode: "NEGOTIATION",
      status: "AGREED",
      governingLaw: "SPAIN",
      contractLanguage: "es",
      parameters: { purpose: "Pilot" },
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-03T00:00:00Z"),
      contractTemplate: { contractType: "NDA", displayName: "NDA" },
      parties: [
        { id: "p-a", userId: "user-alice", role: "INITIATOR", status: "ACCEPTED", email: "alice@example.test", name: "Alice", company: null, signingDetails: { legalName: "Alice SL" } },
        { id: "p-b", userId: "user-bob", role: "RESPONDENT", status: "ACCEPTED", email: "bob@example.test", name: "Bob", company: null, signingDetails: { legalName: "Bob Ltd" } },
      ],
      clauses: [
        {
          status: "AGREED",
          agreedOptionId: "opt-2",
          clauseTemplate: { clauseId: "term", title: "Term" },
          selections: [
            { partyId: "p-a", priority: 4, flexibility: 2, notes: "mine", option: { optionId: "o-1", code: "one", label: "One" } },
            { partyId: "p-b", priority: 5, flexibility: 1, notes: "bob's secret", option: { optionId: "o-2", code: "two", label: "Two" } },
          ],
        },
      ],
    },
  ]);
});

describe("GET /api/account/export", () => {
  it("rejects a signed-out request", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("exports everything for a read-only pilot account", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "user-alice" } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    // The export never checks or moves the pilot window.
    expect(mocks.prisma.user.updateMany).not.toHaveBeenCalled();

    const body = JSON.parse(await res.text());
    expect(body.account.email).toBe("alice@example.test");
    expect(body.deals).toHaveLength(1);
    const [deal] = body.deals;
    expect(deal.parameters).toEqual({ purpose: "Pilot" });
    expect(deal.documents.pdf).toBe("/api/deals/deal-1/document");
    expect(deal.clauses[0].agreedOption).toMatchObject({ code: "two", legalText: "Agreed text." });
    expect(deal.clauses[0].yourSelection).toMatchObject({ code: "one", notes: "mine" });
  });

  it("keeps the other party's selections and signing details private", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "user-alice" } });
    const text = await (await GET()).text();
    expect(text).not.toContain("bob's secret");
    expect(text).not.toContain("Bob Ltd");
    expect(text).toContain("Alice SL");
  });

  it("only reads deals the account is a party to", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "user-alice" } });
    await GET();
    const args = mocks.prisma.dealRoom.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ parties: { some: { userId: "user-alice" } } });
  });
});
