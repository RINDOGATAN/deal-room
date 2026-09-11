// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { reconcileSkillClauses } from "../../../../../prisma/skill-reconcile";

type ClauseRow = {
  id: string;
  clauseId: string;
  retiredAt: Date | null;
  dealRoomClauses?: number;
  options: OptionRow[];
};
type OptionRow = {
  id: string;
  optionId: string;
  retiredAt: Date | null;
  selections?: number;
};

// Minimal stand-in for the Prisma client: enough of clauseTemplate,
// clauseOption and dealRoomClause for the pass to run, plus a record of what
// it wrote. `agreedOptionIds` are options an existing deal agreed on without
// a selection row (agreedOptionId is not a foreign key).
function fakeClient(rows: ClauseRow[], agreedOptionIds: string[] = []) {
  const writes: string[] = [];
  const client = {
    clauseTemplate: {
      findMany: async () =>
        rows.map((c) => ({
          id: c.id,
          clauseId: c.clauseId,
          retiredAt: c.retiredAt,
          _count: { dealRoomClauses: c.dealRoomClauses ?? 0, lawyerRecommendations: 0 },
          options: c.options.map((o) => ({
            id: o.id,
            optionId: o.optionId,
            retiredAt: o.retiredAt,
            _count: {
              partySelections: o.selections ?? 0,
              compromiseSuggestions: 0,
              counterProposals: 0,
              lawyerRecommendations: 0,
            },
          })),
        })),
      delete: async ({ where }: { where: { id: string } }) => {
        writes.push(`delete clause ${where.id}`);
      },
      update: async ({ where }: { where: { id: string } }) => {
        writes.push(`retire clause ${where.id}`);
      },
    },
    clauseOption: {
      delete: async ({ where }: { where: { id: string } }) => {
        writes.push(`delete option ${where.id}`);
      },
      update: async ({ where }: { where: { id: string } }) => {
        writes.push(`retire option ${where.id}`);
      },
    },
    dealRoomClause: {
      findMany: async () => agreedOptionIds.map((id) => ({ agreedOptionId: id })),
    },
  };
  return { client: client as unknown as PrismaClient, writes };
}

const skill = {
  clauses: [{ id: "kept", options: [{ id: "opt-a" }] }],
};

describe("reconcileSkillClauses", () => {
  it("deletes a dropped clause that no deal uses", async () => {
    const { client, writes } = fakeClient([
      { id: "c1", clauseId: "kept", retiredAt: null, options: [{ id: "o1", optionId: "opt-a", retiredAt: null }] },
      { id: "c2", clauseId: "gone", retiredAt: null, options: [{ id: "o2", optionId: "opt-x", retiredAt: null }] },
    ]);

    const result = await reconcileSkillClauses(client, "t1", skill);

    expect(result.deletedClauses).toEqual(["gone"]);
    expect(result.retiredClauses).toEqual([]);
    expect(writes).toEqual(["delete clause c2"]);
  });

  it("retires a dropped clause an existing deal still uses", async () => {
    const { client, writes } = fakeClient([
      { id: "c1", clauseId: "kept", retiredAt: null, options: [{ id: "o1", optionId: "opt-a", retiredAt: null }] },
      {
        id: "c2",
        clauseId: "gone",
        retiredAt: null,
        dealRoomClauses: 1,
        options: [{ id: "o2", optionId: "opt-x", retiredAt: null }],
      },
    ]);

    const result = await reconcileSkillClauses(client, "t1", skill);

    expect(result.retiredClauses).toEqual(["gone"]);
    expect(result.deletedClauses).toEqual([]);
    expect(writes).toEqual(["retire clause c2"]);
  });

  it("retires a clause whose option a deal selected, even with no deal clause count", async () => {
    const { client, writes } = fakeClient([
      { id: "c1", clauseId: "kept", retiredAt: null, options: [{ id: "o1", optionId: "opt-a", retiredAt: null }] },
      {
        id: "c2",
        clauseId: "gone",
        retiredAt: null,
        options: [{ id: "o2", optionId: "opt-x", retiredAt: null, selections: 2 }],
      },
    ]);

    const result = await reconcileSkillClauses(client, "t1", skill);

    expect(result.retiredClauses).toEqual(["gone"]);
    expect(writes).toEqual(["retire clause c2"]);
  });

  it("deletes a renamed option nothing uses and retires one a deal agreed", async () => {
    const { client, writes } = fakeClient(
      [
        {
          id: "c1",
          clauseId: "kept",
          retiredAt: null,
          options: [
            { id: "o1", optionId: "opt-a", retiredAt: null },
            { id: "o2", optionId: "opt-old-unused", retiredAt: null },
            { id: "o3", optionId: "opt-old-agreed", retiredAt: null },
          ],
        },
      ],
      ["o3"]
    );

    const result = await reconcileSkillClauses(client, "t1", skill);

    expect(result.deletedOptions).toEqual(["kept/opt-old-unused"]);
    expect(result.retiredOptions).toEqual(["kept/opt-old-agreed"]);
    expect(writes).toEqual(["delete option o2", "retire option o3"]);
  });

  it("leaves an already retired row alone", async () => {
    const { client, writes } = fakeClient([
      { id: "c1", clauseId: "kept", retiredAt: null, options: [{ id: "o1", optionId: "opt-a", retiredAt: null }] },
      {
        id: "c2",
        clauseId: "gone",
        retiredAt: new Date("2026-09-01"),
        dealRoomClauses: 1,
        options: [{ id: "o2", optionId: "opt-x", retiredAt: null }],
      },
    ]);

    const result = await reconcileSkillClauses(client, "t1", skill);

    expect(result.retiredClauses).toEqual([]);
    expect(writes).toEqual([]);
  });

  it("writes nothing in a dry run", async () => {
    const { client, writes } = fakeClient([
      { id: "c1", clauseId: "kept", retiredAt: null, options: [{ id: "o1", optionId: "opt-a", retiredAt: null }] },
      { id: "c2", clauseId: "gone", retiredAt: null, options: [{ id: "o2", optionId: "opt-x", retiredAt: null }] },
    ]);

    const result = await reconcileSkillClauses(client, "t1", skill, { dryRun: true });

    expect(result.deletedClauses).toEqual(["gone"]);
    expect(writes).toEqual([]);
  });

  it("retires instead of deleting when a deal appears mid-run", async () => {
    const { client, writes } = fakeClient([
      { id: "c1", clauseId: "kept", retiredAt: null, options: [{ id: "o1", optionId: "opt-a", retiredAt: null }] },
      { id: "c2", clauseId: "gone", retiredAt: null, options: [{ id: "o2", optionId: "opt-x", retiredAt: null }] },
    ]);
    // A deal created between the reference check and the delete: Postgres
    // rejects the delete (P2003), and the row must be retired instead.
    (client as unknown as { clauseTemplate: { delete: unknown } }).clauseTemplate.delete = async () => {
      throw Object.assign(new Error("Foreign key constraint failed"), { code: "P2003" });
    };

    const result = await reconcileSkillClauses(client, "t1", skill);

    expect(result.deletedClauses).toEqual([]);
    expect(result.retiredClauses).toEqual(["gone"]);
    expect(writes).toEqual(["retire clause c2"]);
  });
});
