import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyPresetSelections, findPreset } from "../applyPreset";
import { DealMode } from "@prisma/client";

function mockPrisma() {
  return {
    partySelection: { create: vi.fn().mockResolvedValue({}) },
    dealRoomParty: { update: vi.fn().mockResolvedValue({}) },
    dealRoomClause: { update: vi.fn().mockResolvedValue({}) },
    dealRoom: { update: vi.fn().mockResolvedValue({}) },
  };
}

const templateClauses = [
  {
    id: "ct1",
    clauseId: "estructura-voto",
    options: [
      { id: "db-opt-1", optionId: "voto-proporcional" },
      { id: "db-opt-2", optionId: "participaciones-sin-voto" },
    ],
  },
  {
    id: "ct2",
    clauseId: "confidencialidad",
    options: [
      { id: "db-opt-3", optionId: "conf-standard-3yr" },
      { id: "db-opt-4", optionId: "conf-narrow" },
    ],
  },
  {
    id: "ct3",
    clauseId: "single-option-clause",
    options: [{ id: "db-opt-5", optionId: "only-choice" }],
  },
];

const dealClauses = [
  { id: "dc1", clauseTemplateId: "ct1" },
  { id: "dc2", clauseTemplateId: "ct2" },
  { id: "dc3", clauseTemplateId: "ct3" },
];

const preset = {
  id: "express",
  name: { en: "Express" },
  selections: {
    "estructura-voto": "participaciones-sin-voto",
    confidencialidad: "conf-standard-3yr",
    // single-option-clause intentionally omitted — must fall back to its only option
  },
};

describe("findPreset", () => {
  it("finds a preset by id in a valid array", () => {
    expect(findPreset([preset], "express")?.id).toBe("express");
  });

  it("returns null for unknown ids, non-arrays and malformed entries", () => {
    expect(findPreset([preset], "nope")).toBeNull();
    expect(findPreset(null, "express")).toBeNull();
    expect(findPreset({ id: "express" }, "express")).toBeNull();
    expect(findPreset([{ id: "express" }], "express")).toBeNull(); // no selections
  });
});

describe("applyPresetSelections", () => {
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
  });

  it("SOLO: selects every clause (preset + single-option fallback) and agrees the deal", async () => {
    const result = await applyPresetSelections(prisma as never, {
      dealRoomId: "deal1",
      dealMode: DealMode.SOLO,
      partyId: "party1",
      preset,
      templateClauses,
      dealClauses,
    });

    expect(result.agreed).toBe(true);
    expect(result.unresolvedClauseIds).toEqual([]);
    expect(prisma.partySelection.create).toHaveBeenCalledTimes(3);
    expect(prisma.partySelection.create).toHaveBeenCalledWith({
      data: { dealRoomClauseId: "dc1", partyId: "party1", optionId: "db-opt-2" },
    });
    expect(prisma.dealRoomParty.update).toHaveBeenCalledWith({
      where: { id: "party1" },
      data: expect.objectContaining({ status: "SUBMITTED" }),
    });
    expect(prisma.dealRoomClause.update).toHaveBeenCalledTimes(3);
    expect(prisma.dealRoom.update).toHaveBeenCalledWith({
      where: { id: "deal1" },
      data: { status: "AGREED" },
    });
  });

  it("NEGOTIATION: creates selections as a pre-fill but never agrees the deal", async () => {
    const result = await applyPresetSelections(prisma as never, {
      dealRoomId: "deal1",
      dealMode: DealMode.NEGOTIATION,
      partyId: "party1",
      preset,
      templateClauses,
      dealClauses,
    });

    expect(result.agreed).toBe(false);
    expect(prisma.partySelection.create).toHaveBeenCalledTimes(3);
    expect(prisma.dealRoomParty.update).not.toHaveBeenCalled();
    expect(prisma.dealRoom.update).not.toHaveBeenCalled();
  });

  it("SOLO with an unresolvable clause: keeps partial selections but does NOT agree", async () => {
    const badPreset = {
      ...preset,
      selections: { "estructura-voto": "no-such-option" },
    };
    const result = await applyPresetSelections(prisma as never, {
      dealRoomId: "deal1",
      dealMode: DealMode.SOLO,
      partyId: "party1",
      preset: badPreset,
      templateClauses,
      dealClauses,
    });

    // estructura-voto names a bogus option and confidencialidad (multi-option)
    // is uncovered — both unresolved; single-option clause still auto-selects.
    expect(result.agreed).toBe(false);
    expect(result.unresolvedClauseIds).toEqual(["estructura-voto", "confidencialidad"]);
    expect(prisma.partySelection.create).toHaveBeenCalledTimes(1);
    expect(prisma.dealRoom.update).not.toHaveBeenCalled();
  });
});
