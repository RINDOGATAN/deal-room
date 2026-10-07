// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Joint closing counsel by e-mail (Stage B, owner's decision of
 * 6 October 2026): the initiator names the lawyer, the other party is told
 * and acknowledges or declines; no list, no fee.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mail = vi.hoisted(() => ({
  sendJointCounselInviteEmail: vi.fn(async () => true),
  sendJointCounselNotificationEmail: vi.fn(async () => undefined),
  sendOwnLawyerInviteEmail: vi.fn(async () => true),
}));
vi.mock("@/lib/email", () => mail);

import { JOINT_COUNSEL_NOTE, requestJointCounsel } from "@/server/services/attorney/jointCounsel";

type Deal = {
  status?: string;
  jointCounselRequestedAt?: Date | null;
  jointCounselSupervisorId?: string | null;
  stageA?: [string | null, string | null];
};

function makeDb(opts: Deal & { role?: "INITIATOR" | "RESPONDENT"; supervisor?: { id: string; email: string; name: string | null; isActive: boolean } | null } = {}) {
  const parties = [
    { id: "party_0", role: "INITIATOR", email: "founder@startup.example", name: "Founder", company: "Startup Inc", attorneySupervisorId: opts.stageA?.[0] ?? null },
    { id: "party_1", role: "RESPONDENT", email: "other@counterparty.example", name: "Other", company: "Counterparty Ltd", attorneySupervisorId: opts.stageA?.[1] ?? null },
  ];
  if (opts.role === "RESPONDENT") parties[0].role = "RESPONDENT";
  const deal = {
    id: "deal_1",
    name: "Mutual NDA",
    status: opts.status ?? "AGREED",
    jointCounselRequestedAt: opts.jointCounselRequestedAt ?? null,
    jointCounselSupervisorId: opts.jointCounselSupervisorId ?? null,
    parties,
  };
  const db = {
    dealRoomParty: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const p = parties.find((x) => x.id === where.id);
        return p ? { ...p, dealRoom: deal } : null;
      }),
    },
    dealRoom: { update: vi.fn((args: unknown) => args) },
    supervisor: {
      findUnique: vi.fn(async () => opts.supervisor ?? null),
      create: vi.fn(async ({ data }: { data: { email: string; name: string | null } }) => ({ id: "sup_new", isActive: true, ...data })),
    },
    supervisorAssignment: { upsert: vi.fn((args: unknown) => args) },
    auditLog: { create: vi.fn((args: unknown) => args) },
    $transaction: vi.fn(async (list: unknown[]) => list),
  };
  return db;
}

beforeEach(() => vi.clearAllMocks());

describe("requestJointCounsel", () => {
  it("names the lawyer, records the request and tells the lawyer and the other party", async () => {
    const db = makeDb();
    const r = await requestJointCounsel(db as never, { partyId: "party_0", lawyerEmail: " Closing@Lawyers.Example ", lawyerName: "C. Counsel", lang: "es" });
    expect(r).toEqual({ ok: true, supervisorId: "sup_new", lawyerEmail: "closing@lawyers.example", emailSent: true });
    expect(db.dealRoom.update).toHaveBeenCalledWith({
      where: { id: "deal_1" },
      data: expect.objectContaining({ jointCounselSupervisorId: "sup_new", jointCounselRequestedBy: "party_0" }),
    });
    expect(db.supervisorAssignment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { supervisorId: "sup_new", dealRoomId: "deal_1", assignedBy: null },
    }));
    expect(mail.sendJointCounselInviteEmail).toHaveBeenCalledWith({
      to: "closing@lawyers.example",
      lawyerName: "C. Counsel",
      partyName: "Startup Inc",
      dealName: "Mutual NDA",
      lang: "es",
    });
    expect(mail.sendJointCounselNotificationEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "other@counterparty.example", supervisorName: "C. Counsel" }));
  });

  it("only the initiator may name joint counsel", async () => {
    const r = await requestJointCounsel(makeDb({ role: "RESPONDENT" }) as never, { partyId: "party_0", lawyerEmail: "closing@lawyers.example" });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("only once all clauses are agreed", async () => {
    const r = await requestJointCounsel(makeDb({ status: "NEGOTIATING" }) as never, { partyId: "party_0", lawyerEmail: "closing@lawyers.example" });
    expect(r).toMatchObject({ ok: false, code: "NOT_AGREED" });
  });

  it("once per deal: a decline is final", async () => {
    const r = await requestJointCounsel(makeDb({ jointCounselRequestedAt: new Date() }) as never, { partyId: "party_0", lawyerEmail: "closing@lawyers.example" });
    expect(r).toMatchObject({ ok: false, code: "ALREADY_REQUESTED" });
  });

  it("refuses a party's own address", async () => {
    const r = await requestJointCounsel(makeDb() as never, { partyId: "party_0", lawyerEmail: "Other@Counterparty.example" });
    expect(r).toMatchObject({ ok: false, code: "PARTY_EMAIL" });
  });

  it("refuses a lawyer who reviewed for either party", async () => {
    const db = makeDb({ stageA: [null, "sup_a"], supervisor: { id: "sup_a", email: "a@lawyers.example", name: null, isActive: true } });
    const r = await requestJointCounsel(db as never, { partyId: "party_0", lawyerEmail: "a@lawyers.example" });
    expect(r).toMatchObject({ ok: false, code: "LAWYER_ACTED_FOR_A_PARTY" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a deactivated account", async () => {
    const db = makeDb({ supervisor: { id: "sup_x", email: "x@lawyers.example", name: null, isActive: false } });
    const r = await requestJointCounsel(db as never, { partyId: "party_0", lawyerEmail: "x@lawyers.example" });
    expect(r).toMatchObject({ ok: false, code: "LAWYER_UNAVAILABLE" });
  });

  it("the note says the lawyer works for both parties and Dealroom takes no fee", () => {
    expect(JOINT_COUNSEL_NOTE.en).toMatch(/both parties/);
    expect(JOINT_COUNSEL_NOTE.en).toMatch(/takes no fee/);
    expect(JOINT_COUNSEL_NOTE.es).toMatch(/ambas partes/);
  });
});
