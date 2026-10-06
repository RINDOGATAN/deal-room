// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Invite your own lawyer" (owner's decision E1, step 1): the lawyer is
 * put into the existing attorney review for the inviting side, through
 * the transactional e-mail path (mocked here), with no fee, no directory
 * entry and the usual guards.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mail = vi.hoisted(() => ({ sendOwnLawyerInviteEmail: vi.fn(async () => true) }));
vi.mock("@/lib/email", () => mail);

import { MAX_INVITES_PER_DAY, OWN_LAWYER_NOTE, inviteOwnLawyer } from "@/server/services/attorney/ownLawyer";

type Party = {
  id: string;
  role: "INITIATOR" | "RESPONDENT";
  status: string;
  email: string;
  name: string | null;
  company: string | null;
  attorneyReviewRequested: boolean;
  attorneySupervisorId: string | null;
};

function makeDb(opts: { dealStatus?: string; parties?: Partial<Party>[]; supervisor?: { id: string; email: string; name: string | null; isActive: boolean } | null; recent?: number } = {}) {
  const parties: Party[] = (opts.parties ?? [{}]).map((p, i) => ({
    id: `party_${i}`,
    role: i === 0 ? "INITIATOR" : "RESPONDENT",
    status: "SUBMITTED",
    email: i === 0 ? "founder@startup.example" : "other@counterparty.example",
    name: null,
    company: i === 0 ? "Startup Inc" : "Counterparty Ltd",
    attorneyReviewRequested: false,
    attorneySupervisorId: null,
    ...p,
  }));
  const deal = { id: "deal_1", name: "Mutual NDA", status: opts.dealStatus ?? "AGREED", parties };
  const ops: string[] = [];
  const db = {
    dealRoomParty: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const p = parties.find((x) => x.id === where.id);
        return p ? { ...p, dealRoom: deal } : null;
      }),
      update: vi.fn((args: unknown) => { ops.push("party.update"); return args; }),
    },
    auditLog: {
      count: vi.fn(async () => opts.recent ?? 0),
      create: vi.fn((args: unknown) => { ops.push("audit.create"); return args; }),
    },
    supervisor: {
      findUnique: vi.fn(async () => opts.supervisor ?? null),
      create: vi.fn(async ({ data }: { data: { email: string; name: string | null } }) => ({ id: "sup_new", isActive: true, ...data })),
    },
    supervisorAssignment: {
      upsert: vi.fn((args: unknown) => { ops.push("assignment.upsert"); return args; }),
    },
    $transaction: vi.fn(async (list: unknown[]) => list),
  };
  return { db, ops };
}

beforeEach(() => vi.clearAllMocks());

describe("inviteOwnLawyer", () => {
  it("creates the lawyer, opens the review for the inviting side and sends the e-mail", async () => {
    const { db } = makeDb({ parties: [{}, {}] });
    const r = await inviteOwnLawyer(db as never, { partyId: "party_0", lawyerEmail: " Counsel@Lawyers.Example ", lawyerName: "A. Counsel", via: "agent", lang: "es" });
    expect(r).toEqual({ ok: true, supervisorId: "sup_new", lawyerEmail: "counsel@lawyers.example", emailSent: true });
    expect(db.supervisor.create).toHaveBeenCalledWith({ data: { email: "counsel@lawyers.example", name: "A. Counsel", isActive: true } });
    expect(db.dealRoomParty.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "party_0" },
      data: expect.objectContaining({ attorneyReviewRequested: true, attorneySupervisorId: "sup_new" }),
    }));
    expect(db.supervisorAssignment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { supervisorId: "sup_new", dealRoomId: "deal_1", assignedBy: null },
    }));
    expect(db.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "ATTORNEY_INVITED_BY_PARTY", dealRoomId: "deal_1" }) });
    expect(mail.sendOwnLawyerInviteEmail).toHaveBeenCalledWith({
      to: "counsel@lawyers.example",
      lawyerName: "A. Counsel",
      partyName: "Startup Inc",
      dealName: "Mutual NDA",
      lang: "es",
    });
  });

  it("reuses an active lawyer account and adds no bar admission (never listed elsewhere)", async () => {
    const { db } = makeDb({ supervisor: { id: "sup_1", email: "counsel@lawyers.example", name: null, isActive: true } });
    const r = await inviteOwnLawyer(db as never, { partyId: "party_0", lawyerEmail: "counsel@lawyers.example", via: "app" });
    expect(r.ok).toBe(true);
    expect(db.supervisor.create).not.toHaveBeenCalled();
  });

  it("refuses the usual cases and sends nothing", async () => {
    const cases = [
      [makeDb({ dealStatus: "NEGOTIATING", parties: [{ status: "PENDING" }] }), "NOT_READY"],
      [makeDb({ dealStatus: "CANCELLED" }), "DEAL_CLOSED"],
      [makeDb({ parties: [{ attorneyReviewRequested: true }] }), "REVIEW_ALREADY_REQUESTED"],
      [makeDb({ parties: [{}, {}] }), "OTHER_PARTY_EMAIL", "other@counterparty.example"],
      [makeDb({ recent: MAX_INVITES_PER_DAY }), "TOO_MANY_INVITATIONS"],
      [makeDb({ supervisor: { id: "sup_x", email: "x@lawyers.example", name: null, isActive: false } }), "LAWYER_UNAVAILABLE"],
      [makeDb({ supervisor: { id: "sup_2", email: "x@lawyers.example", name: null, isActive: true }, parties: [{}, { attorneySupervisorId: "sup_2" }] }), "LAWYER_ACTS_FOR_OTHER_PARTY"],
    ] as const;
    for (const [{ db }, code, email] of cases) {
      const r = await inviteOwnLawyer(db as never, { partyId: "party_0", lawyerEmail: email ?? "x@lawyers.example", via: "app" });
      expect(r, code).toMatchObject({ ok: false, code });
      expect(db.$transaction, code).not.toHaveBeenCalled();
    }
    expect(mail.sendOwnLawyerInviteEmail).not.toHaveBeenCalled();
  });

  it("says in one plain sentence that the lawyer bills the client and Dealroom takes no fee", () => {
    expect(OWN_LAWYER_NOTE.en).toBe("The lawyer you invite works for you and bills you directly; Dealroom takes no fee and makes no recommendation.");
    for (const s of Object.values(OWN_LAWYER_NOTE)) expect(s).not.toMatch(/[–—]/);
    expect(OWN_LAWYER_NOTE.es).toContain("ti");
    expect(OWN_LAWYER_NOTE.es).not.toMatch(/\busted\b/i);
  });
});
