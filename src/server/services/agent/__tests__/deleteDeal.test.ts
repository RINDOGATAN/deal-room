// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Deleting an agent deal: who may, which deals, and what is written.
 * Prisma is mocked; `deleteDeal.db.test.ts` runs the same against a real
 * database when one is given.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {}, default: {} }));

import { deleteAgentDeal } from "@/server/services/agent/deleteDeal";

type Deal = Record<string, unknown>;

function soloDeal(over: Deal = {}): Deal {
  return {
    id: "adr_1",
    dealRoomId: "room_1",
    initiatorCustomerId: "cust_1",
    respondentCustomerId: null,
    initiatorPlaybookId: null,
    respondentPlaybookId: null,
    negotiationToken: "nt_abc",
    dispute: null,
    dealRoom: {
      id: "room_1",
      dealMode: "SOLO",
      parties: [{ role: "INITIATOR" }],
      invitations: [],
    },
    ...over,
  };
}

const PAYMENT = {
  id: "pay_1",
  dealRoomId: "room_1",
  payerUserId: null,
  payerApiKeyId: "key_1",
  customerId: "cust_1",
  kind: "CREDIT",
  status: "PAID",
  dedupeKey: "credit:room_1",
  stripeCheckoutSessionId: null,
  stripePaymentIntentId: null,
  stripeSubscriptionId: null,
  amount: null,
  currency: null,
  paidAt: new Date("2026-10-01T10:00:00Z"),
  revokedAt: null,
  revokedReason: null,
  createdAt: new Date("2026-10-01T10:00:00Z"),
};

function mockDb(deal: Deal | null, payments: unknown[] = [PAYMENT]) {
  const order: string[] = [];
  const track = (name: string, value: unknown = {}) =>
    vi.fn(async () => {
      order.push(name);
      return value;
    });
  const tx = {
    dealPayment: { findMany: track("dealPayment.findMany", payments) },
    deletedDealPayment: { createMany: track("deletedDealPayment.createMany", { count: payments.length }) },
    idempotencyRecord: { deleteMany: track("idempotencyRecord.deleteMany", { count: 1 }) },
    auditLog: {
      deleteMany: track("auditLog.deleteMany", { count: 1 }),
      create: track("auditLog.create"),
    },
    agentDealRoom: { delete: track("agentDealRoom.delete") },
    dealRoom: { delete: track("dealRoom.delete") },
  };
  const db = {
    agentDealRoom: { findUnique: vi.fn(async () => deal) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { db: db as never, tx, order, raw: db };
}

beforeEach(() => vi.clearAllMocks());

describe("deleteAgentDeal", () => {
  it("deletes the owner's single-party deal and keeps the payment record without names", async () => {
    const { db, tx, order } = mockDb(soloDeal());
    const res = await deleteAgentDeal(db, "cust_1", "adr_1");
    expect(res).toEqual({ ok: true, status: 204, dealRoomId: "room_1", paymentsKept: 1 });

    // The record is copied before the cascade removes it.
    expect(order.indexOf("deletedDealPayment.createMany")).toBeLessThan(order.indexOf("dealRoom.delete"));
    const copied = (tx.deletedDealPayment.createMany.mock.calls[0] as unknown as [{ data: Record<string, unknown>[] }])[0]
      .data[0];
    expect(copied).toMatchObject({ id: "pay_1", dealRoomId: "room_1", agentDealRoomId: "adr_1", customerId: "cust_1", kind: "CREDIT" });
    expect(Object.keys(copied)).not.toEqual(expect.arrayContaining(["name", "company", "email", "parameters"]));

    // Cached answers and audit entries go before the deal; the deal room last.
    expect(tx.idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: {
        customerId: "cust_1",
        OR: expect.arrayContaining([{ responseBody: { contains: "adr_1" } }, { responseBody: { contains: "room_1" } }]),
      },
    });
    expect(tx.auditLog.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ dealRoomId: "room_1" }, { details: { path: ["agentDealRoomId"], equals: "adr_1" } }] },
    });
    expect(order.slice(-3)).toEqual(["agentDealRoom.delete", "dealRoom.delete", "auditLog.create"]);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "AGENT_DEAL_DELETED",
        details: { customerId: "cust_1", agentDealRoomId: "adr_1", deletedDealRoomId: "room_1", paymentsKept: 1 },
      },
    });
  });

  it("writes no copy when the deal was never paid", async () => {
    const { db, tx } = mockDb(soloDeal(), []);
    const res = await deleteAgentDeal(db, "cust_1", "adr_1");
    expect(res).toMatchObject({ ok: true, paymentsKept: 0 });
    expect(tx.deletedDealPayment.createMany).not.toHaveBeenCalled();
  });

  it("answers 404 to another account, without touching anything", async () => {
    const { db, raw } = mockDb(soloDeal());
    const res = await deleteAgentDeal(db, "cust_other", "adr_1");
    expect(res).toMatchObject({ ok: false, status: 404, code: "NOT_FOUND" });
    expect(raw.$transaction).not.toHaveBeenCalled();
  });

  it("answers 404 for a deal that does not exist (or was already deleted)", async () => {
    const { db, raw } = mockDb(null);
    expect(await deleteAgentDeal(db, "cust_1", "adr_gone")).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(raw.$transaction).not.toHaveBeenCalled();
  });

  it("answers the respondent of a two-party deal 404 too: only the creator owns it", async () => {
    const { db } = mockDb(soloDeal({ respondentCustomerId: "cust_2" }));
    expect(await deleteAgentDeal(db, "cust_2", "adr_1")).toMatchObject({ status: 404 });
  });

  const twoParty: [string, Deal][] = [
    ["a negotiation deal", { dealRoom: { id: "room_1", dealMode: "NEGOTIATION", parties: [{ role: "INITIATOR" }, { role: "RESPONDENT" }], invitations: [] } }],
    ["a deal another account joined", { respondentCustomerId: "cust_2" }],
    ["a playbook negotiation not yet joined (no deal room)", { initiatorPlaybookId: "pb_1", dealRoom: null }],
    ["a deal with a dispute", { dispute: { id: "disp_1" } }],
    ["a deal with a respondent party", { dealRoom: { id: "room_1", dealMode: "SOLO", parties: [{ role: "INITIATOR" }, { role: "RESPONDENT" }], invitations: [] } }],
    ["a deal with an accepted invitation", { dealRoom: { id: "room_1", dealMode: "SOLO", parties: [{ role: "INITIATOR" }], invitations: [{ id: "inv_1" }] } }],
  ];
  it.each(twoParty)("refuses %s with 409 and deletes nothing", async (_label, over) => {
    const { db, raw } = mockDb(soloDeal(over));
    const res = await deleteAgentDeal(db, "cust_1", "adr_1");
    expect(res).toMatchObject({ ok: false, status: 409, code: "NOT_SINGLE_PARTY" });
    expect((res as { error: string }).error).toMatch(/single-party/);
    expect(raw.$transaction).not.toHaveBeenCalled();
  });
});
